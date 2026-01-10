import React, { Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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
  const {
    projects,
    scenes,
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
  } = useStoryboard();

  const { showPurchaseModal, setShowPurchaseModal } = useCredits();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard-novo">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/" className="flex items-center gap-2">
              <img
                src="/images/synergy-logo.webp"
                alt="Synergy AI"
                className="h-7 w-auto"
              />
            </Link>
          </div>
          
          <div className="flex items-center gap-3">
            <CreditsCounter variant="compact" />
            <ThemeToggle />
            <Suspense fallback={<div className="w-8 h-8 rounded-full bg-muted animate-pulse" />}>
              <UserProfile />
            </Suspense>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {currentProject ? (
          <ProjectEditor
            project={currentProject}
            scenes={scenes}
            onBack={() => selectProject(null)}
            onUpdateProject={updateProject}
            onAddScene={addScene}
            onUpdateScene={updateScene}
            onDeleteScene={deleteScene}
            onReorderScenes={reorderScenes}
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
