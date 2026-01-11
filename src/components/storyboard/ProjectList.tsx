import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, FolderOpen, Trash2, Calendar, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { StoryboardProject } from '@/hooks/useStoryboard';

interface ProjectListProps {
  projects: StoryboardProject[];
  loading: boolean;
  onSelectProject: (project: StoryboardProject) => void;
  onCreateProject: (name: string, aspectRatio: string, videoModel: string) => Promise<StoryboardProject | null>;
  onDeleteProject: (projectId: string) => Promise<boolean>;
}

const ASPECT_RATIOS = [
  { id: '16:9', label: '16:9 (Widescreen)' },
  { id: '9:16', label: '9:16 (Vertical)' },
  { id: '1:1', label: '1:1 (Quadrado)' },
  { id: '4:3', label: '4:3 (Standard)' },
];

const VIDEO_MODELS = [
  { id: 'bytedance:seedance@1.5-pro', label: 'Seedance 1.5 Pro' },
  { id: 'google:3@3', label: 'Google Veo 3.1 Fast' },
  { id: 'klingai:kling-video@2.6-pro', label: 'Kling Video 2.6 Pro' },
  { id: 'minimax:4@1', label: 'MiniMax Hailuo 2.3' },
  { id: 'lightricks:2@1', label: 'LTX-2 Fast (apenas 16:9)', aspectRatio: '16:9' },
  { id: 'lightricks:2@0', label: 'LTX-2 Pro (apenas 16:9)', aspectRatio: '16:9' },
];

export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  loading,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
}) => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newAspectRatio, setNewAspectRatio] = useState('16:9');
  const [newVideoModel, setNewVideoModel] = useState('bytedance:seedance@1.5-pro');
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleCreate = async () => {
    if (!newProjectName.trim()) return;
    setCreating(true);
    const project = await onCreateProject(newProjectName.trim(), newAspectRatio, newVideoModel);
    setCreating(false);
    if (project) {
      setShowCreateDialog(false);
      setNewProjectName('');
      onSelectProject(project);
    }
  };

  const handleDelete = async (projectId: string) => {
    setDeleting(true);
    await onDeleteProject(projectId);
    setDeleting(false);
    setDeleteConfirm(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Meus Storyboards</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Organize imagens em cenas e gere vídeos
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Projeto
        </Button>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum projeto ainda</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Crie seu primeiro storyboard para começar a organizar suas cenas
            </p>
            <Button onClick={() => setShowCreateDialog(true)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Projeto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card 
                className="group cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg"
                onClick={() => onSelectProject(project)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Film className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium truncate max-w-[180px]">{project.name}</h3>
                        <p className="text-xs text-muted-foreground">{project.aspect_ratio}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(project.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  
                  {project.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {project.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(project.updated_at)}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Project Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Projeto de Storyboard</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Projeto</Label>
              <Input
                placeholder="Meu Storyboard"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="space-y-2">
              <Label>Proporção do Vídeo</Label>
              <Select 
                value={newAspectRatio} 
                onValueChange={setNewAspectRatio}
                disabled={VIDEO_MODELS.find(m => m.id === newVideoModel)?.aspectRatio === '16:9'}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIOS.map((ar) => (
                    <SelectItem key={ar.id} value={ar.id}>
                      {ar.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modelo de Vídeo</Label>
              <Select value={newVideoModel} onValueChange={(v) => {
                setNewVideoModel(v);
                // LTX models only support 16:9
                const selectedModel = VIDEO_MODELS.find(m => m.id === v);
                if (selectedModel?.aspectRatio === '16:9' && newAspectRatio !== '16:9') {
                  setNewAspectRatio('16:9');
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!newProjectName.trim() || creating}>
              {creating ? 'Criando...' : 'Criar Projeto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as cenas do projeto também serão excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
