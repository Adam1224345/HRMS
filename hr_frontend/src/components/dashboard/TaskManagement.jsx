import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; 
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Clock,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Calendar as CalendarIcon,
  User as UserIcon
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const TaskManagement = () => {
  const { t } = useTranslation(); 
  const { hasRole } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTask, setSelectedTask] = useState(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'Pending',
    priority: 'Medium',
    assigned_to_id: '',
    due_date: '',
  });

  const canManageTasks = hasRole('Admin') || hasRole('HR');

  /* ------------------------------------------------------------------ */
  /* Data fetching                                                      */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    fetchTasks();
    if (canManageTasks) fetchUsers();
  }, []);

  const fetchTasks = async () => {
    try {
      const { data } = await axios.get('/tasks');
      setTasks(data.tasks || []);
    } catch (e) {
      setError(t('error_fetch_tasks')); 
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data } = await axios.get('/users');
      setUsers(data.users || []);
    } catch (e) {
      console.error(e);
    }
  };

  /* ------------------------------------------------------------------ */
  /* CRUD handlers                                                      */
  /* ------------------------------------------------------------------ */
  const handleCreateTask = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await axios.post('/tasks', formData);
      setIsCreateDialogOpen(false);
      resetForm();
      fetchTasks();
      setSuccess(t('success_task_created')); 
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.response?.data?.error || t('error_create_task_failed')); 
    }
  };

  const handleUpdateTask = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await axios.put(`/tasks/${selectedTask.id}`, formData);
      setIsEditDialogOpen(false);
      resetForm();
      fetchTasks();
      setSuccess(t('success_task_updated')); 
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.response?.data?.error || t('error_update_task_failed')); 
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm(t('confirm_delete_task'))) return; 
    setError(''); setSuccess('');
    try {
      await axios.delete(`/tasks/${taskId}`);
      fetchTasks();
      setSuccess(t('success_task_deleted')); 
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.response?.data?.error || t('error_delete_task_failed')); 
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      status: 'Pending',
      priority: 'Medium',
      assigned_to_id: '',
      due_date: '',
    });
    setSelectedTask(null);
  };

  const openEditDialog = (task) => {
    setSelectedTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      assigned_to_id: task.assigned_to?.id || '',
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
    });
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (task) => {
    setSelectedTask(task);
    setIsViewDialogOpen(true);
  };

  /* ------------------------------------------------------------------ */
  /* Filtering & helpers                                                */
  /* ------------------------------------------------------------------ */
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.assigned_to?.username.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const cfg = {
      Pending: { icon: Clock, cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      'In Progress': { icon: AlertCircle, cls: 'bg-blue-100 text-blue-800 border-blue-200' },
      Completed: { icon: CheckCircle2, cls: 'bg-green-100 text-green-800 border-green-200' },
    };
    const { icon: Icon, cls } = cfg[status] || cfg.Pending;
    return (
      <Badge className={`${cls} flex items-center gap-1 w-fit`}>
        <Icon className="h-3 w-3" />
        {t(`task_status_${status.toLowerCase().replace(' ', '_')}`)} 
      </Badge>
    );
  };

  const getPriorityBadge = (priority) => {
    const cfg = {
      Low: { cls: 'bg-green-100 text-green-800 border-green-200' },
      Medium: { cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      High: { cls: 'bg-red-100 text-red-800 border-red-200', icon: AlertTriangle },
    };
    const { cls, icon: Icon } = cfg[priority] || cfg.Medium;
    return (
      <Badge className={`${cls} flex items-center gap-1 w-fit`}>
        {Icon && <Icon className="h-3 w-3" />}
        {t(`priority_${priority.toLowerCase()}`)} 
      </Badge>
    );
  };

  const isOverdue = (due) => due && new Date(due) < new Date() && selectedTask?.status !== 'Completed';

  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'Pending').length,
    inProgress: tasks.filter((t) => t.status === 'In Progress').length,
    completed: tasks.filter((t) => t.status === 'Completed').length,
  };

  // --- MOBILE CARD COMPONENT ---
  const MobileTaskCard = ({ task }) => (
    <Card className="mb-4 shadow-sm border-gray-200">
      <CardHeader className="pb-3 border-b bg-gray-50/50 rounded-t-xl">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold">{task.title}</CardTitle>
            <div className="flex items-center text-sm text-gray-500">
              <UserIcon className="h-3 w-3 mr-1" />
              {task.assigned_to?.first_name} {task.assigned_to?.last_name}
            </div>
          </div>
          {getStatusBadge(task.status)}
        </div>
      </CardHeader>
      <CardContent className="pt-3 grid gap-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-500">{t('priority_label')}</span>
          {getPriorityBadge(task.priority)}
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">{t('due_date_label')}</span>
          <span className={`flex items-center ${isOverdue(task.due_date) ? 'text-red-600 font-medium' : ''}`}>
            <CalendarIcon className="h-3 w-3 mr-1" />
            {task.due_date ? new Date(task.due_date).toLocaleDateString(t('locale')) : t('not_set')}
          </span>
        </div>
      </CardContent>
      <CardFooter className="pt-3 border-t bg-gray-50/30 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => openViewDialog(task)} className="h-8">
          <Eye className="h-3.5 w-3.5 mr-1" /> {t('view')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => openEditDialog(task)} className="h-8">
          <Edit className="h-3.5 w-3.5 mr-1" /> {t('edit')}
        </Button>
        {canManageTasks && (
          <Button size="sm" variant="outline" onClick={() => handleDeleteTask(task.id)} className="text-red-600 hover:text-red-800 hover:bg-red-50 h-8">
            <Trash2 className="h-3.5 w-3.5 mr-1" /> {t('delete')}
          </Button>
        )}
      </CardFooter>
    </Card>
  );

  /* ------------------------------------------------------------------ */
  /* Main render                                                        */
  /* ------------------------------------------------------------------ */
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">{t('loading_tasks')}</p> 
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">{t('task_management_title')}</h2> 
          <p className="text-sm md:text-base text-gray-600 mt-1">
            {canManageTasks ? t('task_management_desc_admin') : t('task_management_desc_employee')} 
          </p>
        </div>

        {canManageTasks && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full md:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                <Plus className="h-4 w-4 mr-2" />
                {t('create_task_btn')} 
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('create_new_task_title')}</DialogTitle> 
                <DialogDescription>{t('fill_task_details')}</DialogDescription> 
              </DialogHeader>
              <form onSubmit={handleCreateTask} className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="title">{t('title_label')}</Label> 
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder={t('enter_task_title')} 
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">{t('description_label')}</Label> 
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t('describe_the_task')} 
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="assigned_to">{t('assign_to_label')}</Label> 
                  <Select
                    value={formData.assigned_to_id.toString()}
                    onValueChange={(v) => setFormData({ ...formData, assigned_to_id: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_user')} /> 
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id.toString()}>
                          {u.first_name} {u.last_name} ({u.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="priority">{t('priority_label')}</Label> 
                    <Select
                      value={formData.priority}
                      onValueChange={(v) => setFormData({ ...formData, priority: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">{t('priority_low')}</SelectItem> 
                        <SelectItem value="Medium">{t('priority_medium')}</SelectItem> 
                        <SelectItem value="High">{t('priority_high')}</SelectItem> 
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="due_date">{t('due_date_label')}</Label> 
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    {t('cancel')} 
                  </Button>
                  <Button type="submit">{t('create_task_btn')}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Stats - Responsive Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2 p-4"><CardTitle className="text-xs md:text-sm text-gray-600">{t('total_tasks_stat')}</CardTitle></CardHeader> <CardContent className="p-4 pt-0"><div className="text-xl md:text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardHeader className="pb-2 p-4"><CardTitle className="text-xs md:text-sm text-yellow-600">{t('stat_pending')}</CardTitle></CardHeader> <CardContent className="p-4 pt-0"><div className="text-xl md:text-2xl font-bold text-yellow-600">{stats.pending}</div></CardContent></Card>
        <Card><CardHeader className="pb-2 p-4"><CardTitle className="text-xs md:text-sm text-blue-600">{t('stat_in_progress')}</CardTitle></CardHeader> <CardContent className="p-4 pt-0"><div className="text-xl md:text-2xl font-bold text-blue-600">{stats.inProgress}</div></CardContent></Card>
        <Card><CardHeader className="pb-2 p-4"><CardTitle className="text-xs md:text-sm text-green-600">{t('stat_completed')}</CardTitle></CardHeader> <CardContent className="p-4 pt-0"><div className="text-xl md:text-2xl font-bold text-green-600">{stats.completed}</div></CardContent></Card>
      </div>

      {/* ==================== CONTENT AREA ==================== */}
      <Card className="flex flex-col h-[600px]">
        {/* Responsive Header & Filters */}
        <CardHeader className="flex-shrink-0 pb-3">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle>{t('all_tasks_title')}</CardTitle> 
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_status')}</SelectItem> 
                  <SelectItem value="Pending">{t('status_pending')}</SelectItem> 
                  <SelectItem value="In Progress">{t('status_in_progress')}</SelectItem> 
                  <SelectItem value="Completed">{t('status_completed')}</SelectItem> 
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t('search_tasks_placeholder')} 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-0 sm:p-6 bg-gray-50/50 sm:bg-white">
          
          {/* Mobile Card View */}
          <div className="md:hidden p-4">
             {filteredTasks.length === 0 ? (
                <p className="text-center text-gray-500 py-8">{t('no_tasks_found')}</p>
             ) : (
                filteredTasks.map(task => <MobileTaskCard key={task.id} task={task} />)
             )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead>{t('table_title')}</TableHead> 
                  <TableHead>{t('table_assigned_to')}</TableHead> 
                  <TableHead>{t('table_status')}</TableHead> 
                  <TableHead>{t('table_priority')}</TableHead> 
                  <TableHead>{t('table_due_date')}</TableHead> 
                  <TableHead className="text-right">{t('table_actions')}</TableHead> 
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                      {t('no_tasks_found')} 
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((task) => (
                    <TableRow key={task.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{task.assigned_to?.first_name} {task.assigned_to?.last_name}</div>
                          <div className="text-xs text-gray-500">{task.assigned_to?.username}</div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(task.status)}</TableCell>
                      <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                      <TableCell>
                        {task.due_date ? (
                          <div className={isOverdue(task.due_date) ? 'text-red-600 font-medium' : ''}>
                            {new Date(task.due_date).toLocaleDateString(t('locale'))}
                            {isOverdue(task.due_date) && <span className="text-xs block">{t('overdue')}</span>} 
                          </div>
                        ) : (
                          t('not_set') 
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openViewDialog(task)} title={t('view')}><Eye className="h-4 w-4" /></Button> 
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(task)} title={t('edit')}><Edit className="h-4 w-4" /></Button> 
                          {canManageTasks && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-red-600 hover:text-red-800"
                              title={t('delete')} 
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ==================== DIALOGS ==================== */}
      
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('task_details_title')}</DialogTitle></DialogHeader> 
          {selectedTask && (
            <div className="space-y-4">
              <div><Label className="text-gray-600">{t('title_label')}</Label><p className="font-medium text-lg">{selectedTask.title}</p></div> 
              <div><Label className="text-gray-600">{t('description_label')}</Label><p className="text-sm mt-1">{selectedTask.description || t('none')}</p></div> 
              <div><Label className="text-gray-600">{t('assigned_to_label')}</Label><p className="font-medium">{selectedTask.assigned_to?.first_name} {selectedTask.assigned_to?.last_name}</p></div> 
              <div><Label className="text-gray-600">{t('assigned_by_label')}</Label><p className="font-medium">{selectedTask.assigned_by?.first_name} {selectedTask.assigned_by?.last_name}</p></div> 
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-gray-600">{t('status_label')}</Label><div className="mt-1">{getStatusBadge(selectedTask.status)}</div></div> 
                <div><Label className="text-gray-600">{t('priority_label')}</Label><div className="mt-1">{getPriorityBadge(selectedTask.priority)}</div></div> 
              </div>
              <div><Label className="text-gray-600">{t('due_date_label')}</Label><p className="font-medium">{selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString(t('locale')) : t('not_set')}</p></div> 
              <div><Label className="text-gray-600">{t('created_at_label')}</Label><p className="text-sm">{selectedTask.created_at ? new Date(selectedTask.created_at).toLocaleString(t('locale')) : t('not_set')}</p></div> 
            </div>
          )}
          <div className="flex justify-end pt-2"><Button onClick={() => setIsViewDialogOpen(false)}>{t('close')}</Button></div> 
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('edit_task_title')}</DialogTitle><DialogDescription>{t('update_task_details')}</DialogDescription></DialogHeader> 
          <form onSubmit={handleUpdateTask} className="space-y-4 pt-2">
            {canManageTasks && (
              <>
                <div><Label htmlFor="edit_title">{t('title_label')}</Label><Input id="edit_title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required /></div> 
                <div><Label htmlFor="edit_description">{t('description_label')}</Label><Textarea id="edit_description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} /></div> 
                <div>
                  <Label htmlFor="edit_assigned_to">{t('assign_to_label')}</Label> 
                  <Select value={formData.assigned_to_id.toString()} onValueChange={(v) => setFormData({ ...formData, assigned_to_id: parseInt(v) })}>
                    <SelectTrigger><SelectValue placeholder={t('select_user')} /></SelectTrigger> 
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id.toString()}>
                          {u.first_name} {u.last_name} ({u.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit_priority">{t('priority_label')}</Label> 
                    <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">{t('priority_low')}</SelectItem> 
                        <SelectItem value="Medium">{t('priority_medium')}</SelectItem> 
                        <SelectItem value="High">{t('priority_high')}</SelectItem> 
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="edit_due_date">{t('due_date_label')}</Label> 
                    <Input id="edit_due_date" type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} />
                  </div>
                </div>
              </>
            )}
            <div>
              <Label htmlFor="edit_status">{t('status_label')}</Label> 
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">{t('status_pending')}</SelectItem> 
                  <SelectItem value="In Progress">{t('status_in_progress')}</SelectItem> 
                  <SelectItem value="Completed">{t('status_completed')}</SelectItem> 
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>{t('cancel')}</Button> 
              <Button type="submit">{t('update_task_btn')}</Button> 
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TaskManagement;