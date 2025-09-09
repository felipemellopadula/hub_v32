import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
  const triggeredBy = body.triggered_by || 'cron'
  const isManualCleanup = triggeredBy === 'admin_manual'
  
  console.log(`=== AGGRESSIVE STORAGE CLEANUP STARTED ===`)
  console.log(`Triggered by: ${triggeredBy}`)
  console.log(`Manual cleanup (DELETE EVERYTHING): ${isManualCleanup}`)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey)

    // Get ALL buckets
    const { data: allBuckets } = await supabaseClient.storage.listBuckets()
    const buckets = allBuckets?.map(bucket => bucket.name) || []
    console.log(`Found buckets: ${buckets.join(', ')}`)
    
    // Test for additional common bucket names
    const testBuckets = ['temp', 'uploads', 'cache', 'thumbnails', 'previews', 'generated']
    for (const testBucket of testBuckets) {
      if (!buckets.includes(testBucket)) {
        try {
          const { data } = await supabaseClient.storage.from(testBucket).list('', { limit: 1 })
          if (data && data.length > 0) {
            buckets.push(testBucket)
            console.log(`Found additional bucket: ${testBucket}`)
          }
        } catch (err) {
          // Bucket doesn't exist
        }
      }
    }

    let totalDeleted = 0
    let totalScanned = 0
    let totalFreed = 0
    let errors = []

    // Process each bucket AGGRESSIVELY
    for (const bucketName of buckets) {
      console.log(`\n🗂️ PROCESSING BUCKET: ${bucketName}`)
      
      try {
        // Method 1: Standard list (root level)
        let allFiles = []
        let page = 0
        const limit = 1000
        
        console.log(`📁 Listing files in bucket: ${bucketName}`)
        
        while (true) {
          const { data: files, error } = await supabaseClient.storage
            .from(bucketName)
            .list('', { 
              limit, 
              offset: page * limit,
              sortBy: { column: 'created_at', order: 'asc' }
            })

          if (error) {
            console.error(`Error listing ${bucketName}:`, error)
            break
          }

          if (!files || files.length === 0) break
          
          allFiles = allFiles.concat(files)
          console.log(`Found ${files.length} files in page ${page + 1}`)
          
          if (files.length < limit) break
          page++
        }

        // Method 2: List subdirectories and their contents
        console.log(`🔍 Checking for subdirectories in ${bucketName}...`)
        const directories = allFiles.filter(item => !item.name.includes('.'))
        
        for (const dir of directories) {
          console.log(`📂 Checking subdirectory: ${dir.name}`)
          try {
            let subPage = 0
            while (true) {
              const { data: subFiles, error: subError } = await supabaseClient.storage
                .from(bucketName)
                .list(dir.name, { 
                  limit, 
                  offset: subPage * limit 
                })

              if (subError) {
                console.error(`Error listing subdirectory ${dir.name}:`, subError)
                break
              }

              if (!subFiles || subFiles.length === 0) break

              // Add subdirectory prefix to file paths
              const prefixedFiles = subFiles.map(file => ({
                ...file,
                name: `${dir.name}/${file.name}`
              }))
              
              allFiles = allFiles.concat(prefixedFiles)
              console.log(`Found ${subFiles.length} files in ${dir.name} (page ${subPage + 1})`)
              
              if (subFiles.length < limit) break
              subPage++
            }
          } catch (subErr) {
            console.log(`Could not access subdirectory ${dir.name}:`, subErr.message)
          }
        }

        // Method 3: Try common subdirectory names that might exist
        const commonDirs = ['user-images', 'uploads', 'temp', 'cache', 'thumbnails']
        for (const dirName of commonDirs) {
          if (!directories.some(d => d.name === dirName)) {
            console.log(`🔍 Checking for hidden directory: ${dirName}`)
            try {
              const { data: hiddenFiles, error: hiddenError } = await supabaseClient.storage
                .from(bucketName)
                .list(dirName, { limit: 1000 })

              if (!hiddenError && hiddenFiles && hiddenFiles.length > 0) {
                console.log(`📂 Found hidden directory ${dirName} with ${hiddenFiles.length} files!`)
                const prefixedFiles = hiddenFiles.map(file => ({
                  ...file,
                  name: `${dirName}/${file.name}`
                }))
                allFiles = allFiles.concat(prefixedFiles)
              }
            } catch (err) {
              // Directory doesn't exist, ignore
            }
          }
        }

        totalScanned += allFiles.length
        console.log(`📁 Total files found in ${bucketName}: ${allFiles.length}`)
        
        if (allFiles.length === 0) {
          console.log(`No files in ${bucketName}`)
          continue
        }

        // Show first few files for debugging
        console.log(`First 5 files:`, allFiles.slice(0, 5).map(f => ({
          name: f.name,
          size: f.metadata?.size,
          created: f.created_at
        })))

        // DELETE EVERYTHING in manual cleanup
        let filesToDelete = allFiles
        if (!isManualCleanup) {
          // For automatic cleanup, only delete files older than 1 day
          const cutoff = new Date()
          cutoff.setDate(cutoff.getDate() - 1)
          filesToDelete = allFiles.filter(f => {
            if (!f.created_at) return true // Delete files without timestamp
            return new Date(f.created_at) < cutoff
          })
        }

        console.log(`🗑️ Files to delete: ${filesToDelete.length}`)
        
        if (filesToDelete.length === 0) continue

        // Delete in batches of 5 (even smaller for reliability)
        const batchSize = 5
        let deleted = 0
        
        for (let i = 0; i < filesToDelete.length; i += batchSize) {
          const batch = filesToDelete.slice(i, i + batchSize)
          const paths = batch.map(f => f.name)
          
          console.log(`🗑️ Deleting batch ${Math.floor(i/batchSize) + 1}: ${paths.join(', ')}`)
          
          // Strategy 1: Batch delete with service role
          try {
            const { data: batchResult, error: batchError } = await supabaseClient.storage
              .from(bucketName)
              .remove(paths)
            
            if (!batchError && batchResult) {
              deleted += paths.length
              console.log(`✅ Batch deleted: ${paths.length} files`)
              
              // Calculate freed space
              const batchSize = batch.reduce((sum, f) => sum + (f.metadata?.size || 500000), 0)
              totalFreed += batchSize
              
              // Verify deletion
              await new Promise(r => setTimeout(r, 500)) // Wait a bit
              
              for (const path of paths) {
                try {
                  const { data: checkFile } = await supabaseClient.storage
                    .from(bucketName)
                    .list('', { search: path })
                  
                  if (checkFile && checkFile.length > 0) {
                    console.log(`⚠️ WARNING: File ${path} still exists after batch deletion!`)
                  }
                } catch (checkErr) {
                  // File not found is good
                }
              }
              
              continue // Batch worked, move to next batch
            }
            
            console.error(`Batch delete failed:`, batchError?.message)
          } catch (batchErr) {
            console.error(`Batch delete exception:`, batchErr.message)
          }
          
          // Strategy 2: Individual deletion with multiple attempts
          console.log(`🔄 Trying individual deletion for batch ${Math.floor(i/batchSize) + 1}`)
          
          for (const path of paths) {
            let fileDeleted = false
            
            // Attempt 1: Standard delete
            try {
              const { error: singleError } = await supabaseClient.storage
                .from(bucketName)
                .remove([path])
              
              if (!singleError) {
                deleted++
                fileDeleted = true
                console.log(`✅ Deleted (attempt 1): ${path}`)
              } else {
                console.log(`❌ Delete failed (attempt 1) for ${path}:`, singleError.message)
              }
            } catch (err) {
              console.log(`❌ Delete exception (attempt 1) for ${path}:`, err.message)
            }
            
            if (!fileDeleted) {
              // Attempt 2: Try with explicit RPC call (bypass RLS)
              try {
                await new Promise(r => setTimeout(r, 200))
                
                const { error: rpcError } = await supabaseClient.rpc('delete_storage_file', {
                  bucket_name: bucketName,
                  file_path: path
                })
                
                if (!rpcError) {
                  deleted++
                  fileDeleted = true
                  console.log(`✅ Deleted (RPC attempt): ${path}`)
                } else {
                  console.log(`❌ RPC delete failed for ${path}:`, rpcError.message)
                }
              } catch (rpcErr) {
                console.log(`❌ RPC delete not available for ${path}`)
              }
            }
            
            if (!fileDeleted) {
              // Attempt 3: Raw SQL delete (most aggressive)
              try {
                await new Promise(r => setTimeout(r, 200))
                
                const { error: sqlError } = await supabaseClient
                  .from('storage.objects')
                  .delete()
                  .eq('bucket_id', bucketName)
                  .eq('name', path)
                
                if (!sqlError) {
                  deleted++
                  fileDeleted = true
                  console.log(`✅ Deleted (SQL attempt): ${path}`)
                } else {
                  console.log(`❌ SQL delete failed for ${path}:`, sqlError.message)
                }
              } catch (sqlErr) {
                console.log(`❌ SQL delete not available for ${path}`)
              }
            }
            
            if (!fileDeleted) {
              errors.push(`Failed to delete ${bucketName}/${path} after all attempts`)
              console.log(`❌ FINAL FAILURE: Could not delete ${path}`)
            }
            
            await new Promise(r => setTimeout(r, 150)) // Delay between files
          }
          
          await new Promise(r => setTimeout(r, 300)) // Delay between batches
        }
        
        totalDeleted += deleted
        console.log(`✅ Bucket ${bucketName} completed: ${deleted}/${filesToDelete.length} deleted`)
        
      } catch (bucketError) {
        const msg = `Error processing bucket ${bucketName}: ${bucketError.message}`
        console.error(msg)
        errors.push(msg)
      }
    }

    const duration = Date.now() - startTime
    const freedMB = totalFreed / (1024 * 1024)
    
    console.log(`\n🎉 CLEANUP COMPLETED`)
    console.log(`Files scanned: ${totalScanned}`)
    console.log(`Files deleted: ${totalDeleted}`)
    console.log(`Space freed: ${freedMB.toFixed(2)}MB`)
    console.log(`Errors: ${errors.length}`)
    console.log(`Duration: ${duration}ms`)

    // Log to database
    try {
      await supabaseClient
        .from('storage_cleanup_logs')
        .insert({
          total_files: totalScanned,
          deleted_files: totalDeleted,
          freed_space_mb: parseFloat(freedMB.toFixed(2)),
          errors: errors,
          success: errors.length === 0,
          triggered_by: triggeredBy
        })
    } catch (logErr) {
      console.error('Failed to log to database:', logErr)
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Deleted ${totalDeleted} files, freed ${freedMB.toFixed(2)}MB`,
      stats: {
        totalFiles: totalScanned,
        deletedFiles: totalDeleted,
        freedSpaceMB: parseFloat(freedMB.toFixed(2)),
        errors: errors,
        durationMs: duration
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('CLEANUP FAILED:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})