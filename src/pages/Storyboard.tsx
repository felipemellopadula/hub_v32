import React, { Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CreditsCounter } from '@/components/CreditsCounter';
import { PurchaseCreditsModal } from '@/components/PurchaseCreditsModal';
import { useStoryboard } from '@/hooks/useStoryboard';
import { useCredits } from '@/hooks/useCredits';
import { ProjectList } from '@/components/storyboard/ProjectList';
import { ProjectEditor } from '@/components/storyboard/ProjectEditor';

// Lazy load UserProfile
const UserProfile = lazy(() => import('@/components/UserProfile'));

const StoryboardPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    projects,
    scenes,
    references,
    loading,
    currentProject,
    createProject,
    updateProject,
    deleteProject,
    addScene,
    updateScene,
    deleteScene,
    reorderScenes,
    selectProject,
    addReference,
    updateReference,
    deleteReference,
  } = useStoryboard();

  const { showPurchaseModal, setShowPurchaseModal } = useCredits();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard-novo")}
              className="flex items-center gap-2 hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar</span>
            </Button>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                <Film className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold">Storyboard</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <CreditsCounter variant="compact" />
            <ThemeToggle />
            <Suspense fallback={<div className="w-8 h-8 rounded-full bg-muted animate-pulse" />}>
              <UserProfile />
            </Suspense>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-2 py-4 sm:px-4 sm:py-8">
        {currentProject ? (
          <ProjectEditor
            project={currentProject}
            scenes={scenes}
            references={references}
            onBack={() => selectProject(null)}
            onUpdateProject={updateProject}
            onAddScene={addScene}
            onUpdateScene={updateScene}
            onDeleteScene={deleteScene}
            onReorderScenes={reorderScenes}
            onAddReference={(projectId, imageUrl, name) => addReference(projectId, imageUrl, name)}
            onUpdateReference={updateReference}
            onDeleteReference={deleteReference}
          />
        ) : (
          <ProjectList
            projects={projects}
            loading={loading}
            onSelectProject={selectProject}
            onCreateProject={createProject}
            onDeleteProject={deleteProject}
          />
        )}
      </main>

      {/* Purchase Credits Modal */}
      <PurchaseCreditsModal
        open={showPurchaseModal}
        onOpenChange={setShowPurchaseModal}
      />
    </div>
  );
};

export default StoryboardPage;
