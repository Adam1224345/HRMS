import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // i18n Hook
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Users, 
  Search, 
  Edit, 
  Trash2, 
  UserPlus,
  Eye,
  EyeOff,
  Shield,
  Mail
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const UserManagement = () => {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    is_active: true,
    role_ids: []
  });

  const usersPerPage = 10;

  useEffect(() => {
    if (hasPermission('user_read')) {
      fetchUsers(1);
    }
    fetchRoles();
  }, []);

  const fetchUsers = async (page = 1) => {
    try {
      setLoading(true);
      const response = await axios.get(`/users?page=${page}&per_page=${usersPerPage}`);
      setUsers(response.data.users || []);
      setCurrentPage(response.data.current_page || 1);
      setTotalPages(response.data.pages || 1);
    } catch (error) {
      setError(t('error_fetch_users', 'Failed to fetch users'));
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await axios.get('/roles');
      setRoles(response.data.roles || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/users', formData);
      setIsCreateDialogOpen(false);
      resetForm();
      fetchUsers(currentPage);
      setError('');
    } catch (error) {
      setError(error.response?.data?.error || t('error_create_user', 'Failed to create user'));
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      const updateData = { ...formData };
      if (!updateData.password) {
        delete updateData.password;
      }
      await axios.put(`/users/${selectedUser.id}`, updateData);
      setIsEditDialogOpen(false);
      resetForm();
      fetchUsers(currentPage);
      setError('');
    } catch (error) {
      setError(error.response?.data?.error || t('error_update_user', 'Failed to update user'));
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm(t('confirm_delete_user', 'Are you sure you want to delete this user?'))) {
      try {
        await axios.delete(`/users/${userId}`);
        fetchUsers(currentPage);
        setError('');
      } catch (error) {
        setError(error.response?.data?.error || t('error_delete_user', 'Failed to delete user'));
      }
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      is_active: true,
      role_ids: []
    });
    setSelectedUser(null);
    setShowPassword(false);
  };

  const openEditDialog = (user) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      is_active: user.is_active,
      role_ids: user.roles?.map(role => role.id) || []
    });
    setIsEditDialogOpen(true);
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  if (!hasPermission('user_read')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Alert variant="destructive">
          <AlertDescription>{t('insufficient_permissions', 'Insufficient permissions to view users.')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // --- Mobile User Card Component ---
  const MobileUserCard = ({ user }) => (
    <Card className="mb-4 shadow-sm border-gray-200">
      <CardHeader className="pb-3 border-b bg-gray-50/50 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10 border border-gray-200">
              <AvatarFallback className="bg-blue-100 text-blue-700 font-bold">
                {getInitials(user.first_name, user.last_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-base font-semibold text-gray-900">{user.username}</CardTitle>
              <CardDescription className="text-xs">{user.first_name} {user.last_name}</CardDescription>
            </div>
          </div>
          <Badge variant={user.is_active ? 'default' : 'secondary'} className={user.is_active ? "bg-green-100 text-green-800 border-green-200" : ""}>
            {user.is_active ? t('active', 'Active') : t('inactive', 'Inactive')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4 grid gap-3 text-sm">
        <div className="flex items-center text-gray-600">
          <Mail className="h-4 w-4 mr-2 text-gray-400" />
          <span className="truncate">{user.email}</span>
        </div>
        <div className="flex items-start">
          <Shield className="h-4 w-4 mr-2 text-gray-400 mt-0.5" />
          <div className="flex flex-wrap gap-1">
            {user.roles?.map((role) => (
              <Badge key={role.id} variant="outline" className="text-xs font-normal">
                {role.name}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-3 border-t bg-gray-50/30 flex justify-end gap-2">
        {hasPermission('user_write') && (
          <Button size="sm" variant="outline" onClick={() => openEditDialog(user)} className="h-8">
            <Edit className="h-3.5 w-3.5 mr-1" /> {t('edit', 'Edit')}
          </Button>
        )}
        {hasPermission('user_delete') && (
          <Button size="sm" variant="destructive" onClick={() => handleDeleteUser(user.id)} className="h-8">
            <Trash2 className="h-3.5 w-3.5 mr-1" /> {t('delete', 'Delete')}
          </Button>
        )}
      </CardFooter>
    </Card>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">{t('user_management', 'User Management')}</h2>
          <p className="text-sm md:text-base text-gray-500 mt-1">
            {t('user_management_desc', 'Manage users, roles, and permissions')}
          </p>
        </div>
        
        {hasPermission('user_write') && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 shadow-sm">
                <UserPlus className="h-4 w-4 mr-2" />
                {t('create_user', 'Create User')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('create_new_user', 'Create New User')}</DialogTitle>
                <DialogDescription>{t('create_user_desc', 'Fill in the user details to create a new account.')}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4 pt-2">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="username">{t('username', 'Username')}</Label>
                    <Input id="username" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">{t('email', 'Email')}</Label>
                    <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">{t('password', 'Password')}</Label>
                    <div className="relative">
                      <Input 
                        id="password" 
                        type={showPassword ? 'text' : 'password'} 
                        value={formData.password} 
                        onChange={(e) => setFormData({...formData, password: e.target.value})} 
                        required 
                        className="pr-10" 
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="first_name">{t('first_name', 'First Name')}</Label>
                      <Input id="first_name" value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="last_name">{t('last_name', 'Last Name')}</Label>
                      <Input id="last_name" value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} />
                    </div>
                  </div>
                  
                  <div className="grid gap-2 border p-3 rounded-md bg-gray-50">
                    <Label className="mb-1 block">{t('roles', 'Roles')}</Label>
                    <div className="flex flex-wrap gap-3">
                      {roles.map((role) => (
                        <div key={role.id} className="flex items-center space-x-2 bg-white px-2 py-1 rounded border">
                          <input
                            type="checkbox"
                            id={`create-role-${role.id}`}
                            checked={formData.role_ids.includes(role.id)}
                            onChange={(e) => {
                              if (e.target.checked) setFormData({ ...formData, role_ids: [...formData.role_ids, role.id] });
                              else setFormData({ ...formData, role_ids: formData.role_ids.filter(id => id !== role.id) });
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <Label htmlFor={`create-role-${role.id}`} className="text-sm cursor-pointer">{role.name}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border p-3 rounded-md">
                    <Label htmlFor="is_active" className="cursor-pointer">{t('active_account', 'Active Account')}</Label>
                    <Switch id="is_active" checked={formData.is_active} onCheckedChange={(checked) => setFormData({...formData, is_active: checked})} />
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>{t('cancel', 'Cancel')}</Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">{t('create_user', 'Create User')}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <Card className="border-t-4 border-t-blue-500 shadow-md">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                {t('users_list', 'Users List')} <Badge variant="secondary" className="ml-2">{filteredUsers.length}</Badge>
              </CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t('search_users_placeholder', 'Search users...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-50 focus:bg-white transition-colors"
                />
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0 sm:p-6">
            
            {/* Desktop Table View */}
            <div className="hidden md:block rounded-md border">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="w-[250px]">{t('user', 'User')}</TableHead>
                    <TableHead>{t('email', 'Email')}</TableHead>
                    <TableHead>{t('name', 'Name')}</TableHead>
                    <TableHead>{t('roles', 'Roles')}</TableHead>
                    <TableHead>{t('status', 'Status')}</TableHead>
                    <TableHead className="text-right">{t('actions', 'Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-10">
                        <div className="flex flex-col items-center gap-2">
                          <Users className="h-10 w-10 text-gray-300" />
                          <p>{t('no_users_found', 'No users found')}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id} className="hover:bg-blue-50/30 transition-colors">
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-9 w-9 border border-gray-200">
                              <AvatarFallback className="bg-blue-50 text-blue-600 font-medium">
                                {getInitials(user.first_name, user.last_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-gray-900">{user.username}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-600">{user.email}</TableCell>
                        <TableCell>{user.first_name} {user.last_name}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.roles?.map((role) => (
                              <Badge key={role.id} variant="secondary" className="text-xs font-normal border-gray-200">
                                {role.name}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.is_active ? 'default' : 'secondary'} className={user.is_active ? "bg-green-100 text-green-700 hover:bg-green-200 border-green-200" : "bg-gray-100 text-gray-600"}>
                            {user.is_active ? t('active', 'Active') : t('inactive', 'Inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            {hasPermission('user_write') && (
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50" onClick={() => openEditDialog(user)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {hasPermission('user_delete') && (
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:bg-red-50" onClick={() => handleDeleteUser(user.id)}>
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

            {/* Mobile Card View */}
            <div className="md:hidden p-4 bg-gray-50/50">
              {filteredUsers.length === 0 ? (
                 <div className="text-center py-8 text-gray-500">{t('no_users_found', 'No users found')}</div>
              ) : (
                 filteredUsers.map(user => <MobileUserCard key={user.id} user={user} />)
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-4 border-t">
                <Button variant="outline" size="sm" onClick={() => fetchUsers(currentPage - 1)} disabled={currentPage === 1}>
                  {t('previous', 'Previous')}
                </Button>
                <span className="text-sm text-gray-500">
                  {t('page_of_total', { page: currentPage, total: totalPages, defaultValue: `Page ${currentPage} of ${totalPages}` })}
                </span>
                <Button variant="outline" size="sm" onClick={() => fetchUsers(currentPage + 1)} disabled={currentPage === totalPages}>
                  {t('next', 'Next')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('edit_user', 'Edit User')}</DialogTitle>
            <DialogDescription>{t('edit_user_desc', 'Update user information.')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateUser} className="space-y-4 pt-2">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit_username">{t('username', 'Username')}</Label>
                <Input id="edit_username" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit_email">{t('email', 'Email')}</Label>
                <Input id="edit_email" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit_password">{t('new_password_placeholder', 'New Password (leave blank to keep current)')}</Label>
                <div className="relative">
                  <Input 
                    id="edit_password" 
                    type={showPassword ? 'text' : 'password'} 
                    value={formData.password} 
                    onChange={(e) => setFormData({...formData, password: e.target.value})} 
                    className="pr-10" 
                    placeholder={t('leave_blank_to_keep', 'Leave blank to keep')}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit_first_name">{t('first_name', 'First Name')}</Label>
                  <Input id="edit_first_name" value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit_last_name">{t('last_name', 'Last Name')}</Label>
                  <Input id="edit_last_name" value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} />
                </div>
              </div>
              
              <div className="grid gap-2 border p-3 rounded-md bg-gray-50">
                <Label className="mb-1 block">{t('roles', 'Roles')}</Label>
                <div className="flex flex-wrap gap-3">
                  {roles.map((role) => (
                    <div key={role.id} className="flex items-center space-x-2 bg-white px-2 py-1 rounded border">
                      <input
                        type="checkbox"
                        id={`edit-role-${role.id}`}
                        checked={formData.role_ids.includes(role.id)}
                        onChange={(e) => {
                          if (e.target.checked) setFormData({ ...formData, role_ids: [...formData.role_ids, role.id] });
                          else setFormData({ ...formData, role_ids: formData.role_ids.filter(id => id !== role.id) });
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <Label htmlFor={`edit-role-${role.id}`} className="text-sm cursor-pointer">{role.name}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between border p-3 rounded-md">
                <Label htmlFor="edit_is_active" className="cursor-pointer">{t('active_account', 'Active Account')}</Label>
                <Switch id="edit_is_active" checked={formData.is_active} onCheckedChange={(checked) => setFormData({...formData, is_active: checked})} />
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>{t('cancel', 'Cancel')}</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">{t('update_user', 'Update User')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;