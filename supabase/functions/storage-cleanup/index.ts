import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CleanupStats {
  totalFiles: number
  deletedFiles: number
  freedSpaceMB: number
  errors: string[]
  processedBuckets: string[]
  skippedFiles: number
}

interface BucketStats {
  name: string
  totalFiles: number
  oldFiles: number
  deletedFiles: number
  freedSpaceMB: number
  errors: string[]
}

async function logCleanupToDatabase(supabase: any, stats: CleanupStats, success: boolean, triggeredBy: string) {
  try {
    const { error } = await supabase
      .from('storage_cleanup_logs')
      .insert({
        total_files: stats.totalFiles,
        deleted_files: stats.deletedFiles,
        freed_space_mb: stats.freedSpaceMB,
        errors: stats.errors,
        success: success,
        triggered_by: triggeredBy
      })
    
    if (error) {
      console.error('Failed to log cleanup to database:', error)
    } else {
      console.log('Cleanup logged to database successfully')
    }
  } catch (error) {
    console.error('Error logging cleanup to database:', error)
  }
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
  
  console.log(`=== Storage Cleanup Started ===`)
  console.log(`Triggered by: ${triggeredBy}`)
  console.log(`Manual cleanup: ${isManualCleanup}`)
  console.log(`Start time: ${new Date().toISOString()}`)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey)

    const buckets = ['images', 'documents', 'user-videos', 'video-refs']
    const cutoffDate = new Date()
    if (!isManualCleanup) {
      cutoffDate.setDate(cutoffDate.getDate() - 1) // Remove files older than 1 day for automatic cleanup
    }

    let totalStats: CleanupStats = {
      totalFiles: 0,
      deletedFiles: 0,
      freedSpaceMB: 0,
      errors: [],
      processedBuckets: [],
      skippedFiles: 0
    }

    console.log(`Target cutoff date: ${isManualCleanup ? 'ALL FILES (manual cleanup)' : cutoffDate.toISOString()}`)
    console.log(`Processing ${buckets.length} buckets: ${buckets.join(', ')}`)

    for (const bucketName of buckets) {
      const bucketStartTime = Date.now()
      console.log(`\n--- Processing bucket: ${bucketName} ---`)
      
      let bucketStats: BucketStats = {
        name: bucketName,
        totalFiles: 0,
        oldFiles: 0,
        deletedFiles: 0,
        freedSpaceMB: 0,
        errors: []
      }
      
      try {
        // List all files in bucket with pagination
        let allFiles: any[] = []
        let offset = 0
        const batchSize = 1000
        
        while (true) {
          console.log(`Fetching files from ${bucketName}, offset: ${offset}`)
          
          const { data: files, error: listError } = await supabaseClient.storage
            .from(bucketName)
            .list('', {
              limit: batchSize,
              offset: offset,
              sortBy: { column: 'created_at', order: 'asc' }
            })

          if (listError) {
            const errorMsg = `Error listing files in ${bucketName} at offset ${offset}: ${listError.message}`
            console.error(errorMsg)
            bucketStats.errors.push(errorMsg)
            totalStats.errors.push(errorMsg)
            break
          }

          if (!files || files.length === 0) {
            break
          }

          allFiles = allFiles.concat(files)
          offset += batchSize

          if (files.length < batchSize) {
            break // No more files to fetch
          }
        }

        bucketStats.totalFiles = allFiles.length
        totalStats.totalFiles += allFiles.length
        
        if (allFiles.length === 0) {
          console.log(`No files found in bucket ${bucketName}`)
          totalStats.processedBuckets.push(bucketName)
          continue
        }

        console.log(`Total files found in ${bucketName}: ${allFiles.length}`)

        // Filter files based on cleanup type
        const filesToDelete = allFiles.filter(file => {
          if (isManualCleanup) {
            console.log(`Manual cleanup: will delete ${file.name}`)
            return true // Delete ALL files in manual cleanup
          }
          
          if (!file.created_at) {
            console.log(`File ${file.name} has no created_at timestamp, will delete (assuming old)`)
            return true // Delete files without timestamp
          }
          
          const fileDate = new Date(file.created_at)
          const isOld = fileDate < cutoffDate
          
          if (isOld) {
            console.log(`File to delete: ${file.name} (created: ${fileDate.toISOString()})`)
          }
          
          return isOld
        })

        bucketStats.oldFiles = filesToDelete.length
        console.log(`Files eligible for deletion in ${bucketName}: ${filesToDelete.length}`)

        if (filesToDelete.length === 0) {
          console.log(`No old files to delete in ${bucketName}`)
          totalStats.processedBuckets.push(bucketName)
          continue
        }

        // Delete files in smaller batches with better error handling
        const deleteBatchSize = 25 // Reduced batch size for more reliable deletion
        console.log(`Starting deletion of ${filesToDelete.length} files in batches of ${deleteBatchSize}`)
        
        for (let i = 0; i < filesToDelete.length; i += deleteBatchSize) {
          const batch = filesToDelete.slice(i, i + deleteBatchSize)
          const pathsToDelete = batch.map(file => file.name)
          const batchNumber = Math.floor(i / deleteBatchSize) + 1
          const totalBatches = Math.ceil(filesToDelete.length / deleteBatchSize)

          console.log(`Deleting batch ${batchNumber}/${totalBatches}: ${pathsToDelete.length} files from ${bucketName}`)
          console.log(`Files in batch: ${pathsToDelete.slice(0, 3).join(', ')}${pathsToDelete.length > 3 ? '...' : ''}`)

          try {
            const { data: deleteResult, error: deleteError } = await supabaseClient.storage
              .from(bucketName)
              .remove(pathsToDelete)

            if (deleteError) {
              const errorMsg = `Error deleting batch ${batchNumber} from ${bucketName}: ${deleteError.message}`
              console.error(errorMsg)
              bucketStats.errors.push(errorMsg)
              totalStats.errors.push(errorMsg)
              
              // Try individual file deletion for failed batch
              console.log(`Attempting individual deletion for failed batch ${batchNumber}`)
              for (const path of pathsToDelete) {
                try {
                  const { error: singleError } = await supabaseClient.storage
                    .from(bucketName)
                    .remove([path])
                  
                  if (!singleError) {
                    bucketStats.deletedFiles++
                    totalStats.deletedFiles++
                    console.log(`Successfully deleted individual file: ${path}`)
                  } else {
                    console.error(`Failed to delete individual file ${path}:`, singleError)
                  }
                } catch (singleDeleteError) {
                  console.error(`Exception deleting individual file ${path}:`, singleDeleteError)
                }
                
                // Small delay between individual deletions
                await new Promise(resolve => setTimeout(resolve, 50))
              }
            } else {
              bucketStats.deletedFiles += pathsToDelete.length
              totalStats.deletedFiles += pathsToDelete.length
              
              // Calculate freed space more accurately
              const estimatedSize = batch.reduce((sum, file) => {
                const size = file.metadata?.size || 500000 // 500KB default estimate
                return sum + size
              }, 0)
              
              const freedMB = estimatedSize / (1024 * 1024)
              bucketStats.freedSpaceMB += freedMB
              totalStats.freedSpaceMB += freedMB
              
              console.log(`✓ Successfully deleted batch ${batchNumber}: ${pathsToDelete.length} files, ~${freedMB.toFixed(2)}MB`)
            }
          } catch (batchError) {
            const errorMsg = `Exception deleting batch ${batchNumber} from ${bucketName}: ${batchError.message}`
            console.error(errorMsg)
            bucketStats.errors.push(errorMsg)
            totalStats.errors.push(errorMsg)
          }

          // Delay between batches to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200))
        }

        // Clean up database records for successfully deleted files
        if (bucketStats.deletedFiles > 0) {
          console.log(`Cleaning up database records for ${bucketName}`)
          
          if (bucketName === 'images') {
            try {
              const deletedPaths = filesToDelete.slice(0, bucketStats.deletedFiles).map(file => file.name)
              const { error: dbError } = await supabaseClient
                .from('user_images')
                .delete()
                .in('image_path', deletedPaths)

              if (dbError) {
                const errorMsg = `Error cleaning up user_images records: ${dbError.message}`
                console.error(errorMsg)
                bucketStats.errors.push(errorMsg)
                totalStats.errors.push(errorMsg)
              } else {
                console.log(`✓ Cleaned up ${deletedPaths.length} user_images database records`)
              }
            } catch (dbCleanupError) {
              const errorMsg = `Exception cleaning user_images records: ${dbCleanupError.message}`
              console.error(errorMsg)
              bucketStats.errors.push(errorMsg)
              totalStats.errors.push(errorMsg)
            }
          }

          if (bucketName === 'user-videos') {
            try {
              const deletedPaths = filesToDelete.slice(0, bucketStats.deletedFiles).map(file => file.name)
              const videoUrls = deletedPaths.map(path => `${bucketName}/${path}`)
              
              const { error: dbError } = await supabaseClient
                .from('user_videos')
                .delete()
                .in('video_url', videoUrls)

              if (dbError) {
                const errorMsg = `Error cleaning up user_videos records: ${dbError.message}`
                console.error(errorMsg)
                bucketStats.errors.push(errorMsg)
                totalStats.errors.push(errorMsg)
              } else {
                console.log(`✓ Cleaned up ${videoUrls.length} user_videos database records`)
              }
            } catch (dbCleanupError) {
              const errorMsg = `Exception cleaning user_videos records: ${dbCleanupError.message}`
              console.error(errorMsg)
              bucketStats.errors.push(errorMsg)
              totalStats.errors.push(errorMsg)
            }
          }
        }

        const bucketDuration = Date.now() - bucketStartTime
        console.log(`--- Bucket ${bucketName} completed in ${bucketDuration}ms ---`)
        console.log(`Bucket stats: ${bucketStats.totalFiles} total, ${bucketStats.oldFiles} old, ${bucketStats.deletedFiles} deleted, ${bucketStats.freedSpaceMB.toFixed(2)}MB freed, ${bucketStats.errors.length} errors`)
        
        totalStats.processedBuckets.push(bucketName)

      } catch (error) {
        const errorMsg = `Unexpected error processing bucket ${bucketName}: ${error.message}`
        console.error(errorMsg)
        bucketStats.errors.push(errorMsg)
        totalStats.errors.push(errorMsg)
        totalStats.processedBuckets.push(`${bucketName} (failed)`)
      }
    }

    const totalDuration = Date.now() - startTime
    const success = totalStats.errors.length === 0
    
    // Log comprehensive final stats
    console.log(`\n=== Storage Cleanup Summary ===`)
    console.log(`Duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}s)`)
    console.log(`Processed buckets: ${totalStats.processedBuckets.join(', ')}`)
    console.log(`Total files scanned: ${totalStats.totalFiles}`)
    console.log(`Files deleted: ${totalStats.deletedFiles}`)
    console.log(`Files skipped: ${totalStats.skippedFiles}`)
    console.log(`Space freed: ${totalStats.freedSpaceMB.toFixed(2)}MB`)
    console.log(`Errors: ${totalStats.errors.length}`)
    console.log(`Success: ${success}`)
    
    if (totalStats.errors.length > 0) {
      console.log(`Error details:`)
      totalStats.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`)
      })
    }

    // Log to database
    await logCleanupToDatabase(supabaseClient, totalStats, success, triggeredBy)

    const response = {
      success: success,
      message: success 
        ? `Storage cleanup completed successfully. Deleted ${totalStats.deletedFiles} files, freed ${totalStats.freedSpaceMB.toFixed(2)}MB`
        : `Storage cleanup completed with ${totalStats.errors.length} errors`,
      stats: {
        totalFiles: totalStats.totalFiles,
        deletedFiles: totalStats.deletedFiles,
        freedSpaceMB: parseFloat(totalStats.freedSpaceMB.toFixed(2)),
        errors: totalStats.errors,
        processedBuckets: totalStats.processedBuckets,
        skippedFiles: totalStats.skippedFiles,
        durationMs: totalDuration
      },
      timestamp: new Date().toISOString()
    }

    console.log(`=== Storage Cleanup Completed ===\n`)

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    const duration = Date.now() - startTime
    console.error('=== Storage cleanup failed ===')
    console.error(`Duration: ${duration}ms`)
    console.error('Error:', error)
    
    // Try to log failure to database
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      await logCleanupToDatabase(supabaseClient, {
        totalFiles: 0,
        deletedFiles: 0,
        freedSpaceMB: 0,
        errors: [error.message],
        processedBuckets: [],
        skippedFiles: 0
      }, false, triggeredBy)
    } catch (logError) {
      console.error('Failed to log error to database:', logError)
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      durationMs: duration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})