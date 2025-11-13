import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const TaskManagement = () => {
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
  /*  Data fetching                                                     */
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
      setError('Failed to fetch tasks');
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
  /*  CRUD handlers                                                    */
  /* ------------------------------------------------------------------ */
  const handleCreateTask = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await axios.post('/tasks', formData);
      setIsCreateDialogOpen(false);
      resetForm();
      fetchTasks();
      setSuccess('Task created successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to create task');
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
      setSuccess('Task updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    setError(''); setSuccess('');
    try {
      await axios.delete(`/tasks/${taskId}`);
      fetchTasks();
      setSuccess('Task deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to delete task');
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
  /*  Filtering & helpers                                              */
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
      <Badge className={`${cls} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {status}
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
      <Badge className={`${cls} flex items-center gap-1`}>
        {Icon && <Icon className="h-3 w-3" />}
        {priority}
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

  /* ------------------------------------------------------------------ */
  /*  Loading UI                                                       */
  /* ------------------------------------------------------------------ */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading tasks...</p>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Main render                                                      */
  /* ------------------------------------------------------------------ */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Task Management</h2>
          <p className="text-gray-600 mt-2">
            {canManageTasks ? 'Assign and manage tasks for your team' : 'View and update your assigned tasks'}
          </p>
        </div>

        {canManageTasks && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>Fill in the task details.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter task title"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the task..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="assigned_to">Assign To</Label>
                  <Select
                    value={formData.assigned_to_id.toString()}
                    onValueChange={(v) => setFormData({ ...formData, assigned_to_id: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
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
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(v) => setFormData({ ...formData, priority: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="due_date">Due Date</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Task</Button>
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-600">Total Tasks</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-yellow-600">Pending</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-yellow-600">{stats.pending}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-blue-600">In Progress</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-green-600">Completed</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{stats.completed}</div></CardContent>
        </Card>
      </div>

      {/* ==================== SCROLLABLE TASK CARD ==================== */}
      <Card className="flex flex-col h-96">
        {/* Header + Filters (always visible) */}
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <CardTitle>All Tasks</CardTitle>
            <div className="flex gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Scrollable Table */}
        <CardContent className="flex-1 overflow-y-auto p-0">
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10 border-b">
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    No tasks found
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((task) => (
                  <TableRow key={task.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{task.assigned_to?.first_name} {task.assigned_to?.last_name}</div>
                        <div className="text-sm text-gray-500">{task.assigned_to?.username}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(task.status)}</TableCell>
                    <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                    <TableCell>
                      {task.due_date ? (
                        <div className={isOverdue(task.due_date) ? 'text-red-600 font-medium' : ''}>
                          {new Date(task.due_date).toLocaleDateString()}
                          {isOverdue(task.due_date) && <span className="text-xs block">Overdue</span>}
                        </div>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openViewDialog(task)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(task)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {canManageTasks && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-red-600 hover:text-red-800"
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
        </CardContent>
      </Card>

      {/* ==================== DIALOGS (unchanged) ==================== */}
      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Task Details</DialogTitle></DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div><Label className="text-gray-600">Title</Label><p className="font-medium text-lg">{selectedTask.title}</p></div>
              <div><Label className="text-gray-600">Description</Label><p className="text-sm mt-1">{selectedTask.description || 'None'}</p></div>
              <div><Label className="text-gray-600">Assigned To</Label><p className="font-medium">{selectedTask.assigned_to?.first_name} {selectedTask.assigned_to?.last_name}</p></div>
              <div><Label className="text-gray-600">Assigned By</Label><p className="font-medium">{selectedTask.assigned_by?.first_name} {selectedTask.assigned_by?.last_name}</p></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-gray-600">Status</Label><div className="mt-1">{getStatusBadge(selectedTask.status)}</div></div>
                <div><Label className="text-gray-600">Priority</Label><div className="mt-1">{getPriorityBadge(selectedTask.priority)}</div></div>
              </div>
              <div><Label className="text-gray-600">Due Date</Label><p className="font-medium">{selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString() : 'Not set'}</p></div>
              <div><Label className="text-gray-600">Created At</Label><p className="text-sm">{new Date(selectedTask.created_at).toLocaleString()}</p></div>
            </div>
          )}
          <div className="flex justify-end"><Button onClick={() => setIsViewDialogOpen(false)}>Close</Button></div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Task</DialogTitle><DialogDescription>Update task details.</DialogDescription></DialogHeader>
          <form onSubmit={handleUpdateTask} className="space-y-4">
            {canManageTasks && (
              <>
                <div><Label htmlFor="edit_title">Title</Label><Input id="edit_title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required /></div>
                <div><Label htmlFor="edit_description">Description</Label><Textarea id="edit_description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} /></div>
                <div>
                  <Label htmlFor="edit_assigned_to">Assign To</Label>
                  <Select value={formData.assigned_to_id.toString()} onValueChange={(v) => setFormData({ ...formData, assigned_to_id: parseInt(v) })}>
                    <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
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
                    <Label htmlFor="edit_priority">Priority</Label>
                    <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="edit_due_date">Due Date</Label>
                    <Input id="edit_due_date" type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} />
                  </div>
                </div>
              </>
            )}
            <div>
              <Label htmlFor="edit_status">Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Update Task</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TaskManagement;