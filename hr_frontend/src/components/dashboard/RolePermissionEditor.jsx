
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from '@/components/ui/label';
import { 
  Shield, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  ShieldPlus,
  AlertCircle,
  CheckCircle,
  Loader
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import PermissionMatrix from './PermissionMatrix';
import * as rolePermissionsAPI from '@/api/rolePermissions';

const RolePermissionEditor = () => {
  const { hasPermission } = useAuth();
  
  // State management
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permission_ids: []
  });

  /**
   * Load roles and permissions on component mount
   */
  useEffect(() => {
    loadData();
  }, []);

  /**
   * Auto-dismiss success messages after 3 seconds
   */
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  /**
   * Load roles and permissions from API
   */
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [rolesData, permissionsData] = await Promise.all([
        rolePermissionsAPI.fetchRoles(),
        rolePermissionsAPI.fetchPermissions()
      ]);
      
      setRoles(rolesData.roles || []);
      setPermissions(permissionsData.permissions || []);
    } catch (err) {
      setError('Failed to load roles and permissions. Please try again.');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle role creation
   */
  const handleCreateRole = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Role name is required');
      return;
    }

    setIsSubmitting(true);
    setError('');
    
    try {
      await rolePermissionsAPI.createRole(formData);
      setSuccess('Role created successfully');
      setIsCreateDialogOpen(false);
      resetForm();
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to create role');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle role update
   */
  const handleUpdateRole = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Role name is required');
      return;
    }

    setIsSubmitting(true);
    setError('');
    
    try {
      await rolePermissionsAPI.updateRole(selectedRole.id, formData);
      setSuccess('Role updated successfully');
      setIsEditDialogOpen(false);
      resetForm();
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to update role');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle role deletion
   */
  const handleDeleteRole = async (roleId) => {
    if (!window.confirm('Are you sure you want to delete this role? This action cannot be undone.')) {
      return;
    }

    setError('');
    
    try {
      await rolePermissionsAPI.deleteRole(roleId);
      setSuccess('Role deleted successfully');
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to delete role');
    }
  };

  /**
   * Reset form to initial state
   */
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      permission_ids: []
    });
    setSelectedRole(null);
  };

  /**
   * Open edit dialog with role data
   */
  const openEditDialog = (role) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      permission_ids: role.permissions?.map(p => p.id) || []
    });
    setIsEditDialogOpen(true);
  };

  /**
   * Handle permission changes from PermissionMatrix
   */
  const handlePermissionChange = (permissionIds) => {
    setFormData(prev => ({
      ...prev,
      permission_ids: permissionIds
    }));
  };

  /**
   * Filter roles based on search term
   */
  const filteredRoles = roles.filter(role =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Permission check
  if (!hasPermission('role_read')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Insufficient permissions to view roles.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-8 w-8 text-blue-600" />
            Role & Permission Management
          </h2>
          <p className="text-gray-600 mt-2">
            Create and manage roles with granular permission control
          </p>
        </div>
        
        {hasPermission('role_write') && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Plus className="h-4 w-4" />
                New Role
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Role</DialogTitle>
                <DialogDescription>
                  Define a new role and assign permissions using the matrix below.
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleCreateRole} className="space-y-6">
                {/* Role Name */}
                <div>
                  <Label htmlFor="create_name" className="text-base font-semibold">
                    Role Name
                  </Label>
                  <Input
                    id="create_name"
                    placeholder="e.g., Manager, Supervisor"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                    className="mt-2"
                  />
                </div>

                {/* Role Description */}
                <div>
                  <Label htmlFor="create_description" className="text-base font-semibold">
                    Description
                  </Label>
                  <Textarea
                    id="create_description"
                    placeholder="Describe the purpose and responsibilities of this role..."
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={3}
                    className="mt-2"
                  />
                </div>

                {/* Permission Matrix */}
                <div>
                  <Label className="text-base font-semibold">
                    Assign Permissions
                  </Label>
                  <p className="text-sm text-gray-600 mt-1 mb-4">
                    Select the permissions this role should have. You can expand/collapse categories and use the All/None buttons for quick selection.
                  </p>
                  <PermissionMatrix
                    permissions={permissions}
                    selectedPermissionIds={formData.permission_ids}
                    onPermissionChange={handlePermissionChange}
                    compact={true}
                  />
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      resetForm();
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Create Role
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Alert Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader className="h-12 w-12 animate-spin mx-auto text-blue-600 mb-4" />
            <p className="text-gray-600">Loading roles and permissions...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Roles Table */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center gap-4">
                <div>
                  <CardTitle>Roles ({filteredRoles.length})</CardTitle>
                  <CardDescription>
                    Manage all roles and their permissions
                  </CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search roles..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredRoles.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {searchTerm ? 'No roles match your search' : 'No roles found. Create one to get started.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Role Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Permissions</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRoles.map((role) => (
                        <TableRow key={role.id} className="hover:bg-gray-50">
                          <TableCell className="font-semibold text-gray-900">
                            {role.name}
                          </TableCell>
                          <TableCell className="text-gray-600 max-w-xs truncate">
                            {role.description || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {role.permissions && role.permissions.length > 0 ? (
                                <>
                                  {role.permissions.slice(0, 3).map((perm) => (
                                    <Badge
                                      key={perm.id}
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {rolePermissionsAPI.formatPermissionName(perm.name)}
                                    </Badge>
                                  ))}
                                  {role.permissions.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{role.permissions.length - 3}
                                    </Badge>
                                  )}
                                </>
                              ) : (
                                <span className="text-gray-500 text-sm">No permissions</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {hasPermission('role_write') && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEditDialog(role)}
                                  title="Edit role"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {hasPermission('role_delete') && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeleteRole(role.id)}
                                  title="Delete role"
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Role</DialogTitle>
                <DialogDescription>
                  Update role information and permissions.
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleUpdateRole} className="space-y-6">
                {/* Role Name */}
                <div>
                  <Label htmlFor="edit_name" className="text-base font-semibold">
                    Role Name
                  </Label>
                  <Input
                    id="edit_name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                    className="mt-2"
                  />
                </div>

                {/* Role Description */}
                <div>
                  <Label htmlFor="edit_description" className="text-base font-semibold">
                    Description
                  </Label>
                  <Textarea
                    id="edit_description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={3}
                    className="mt-2"
                  />
                </div>

                {/* Permission Matrix */}
                <div>
                  <Label className="text-base font-semibold">
                    Assign Permissions
                  </Label>
                  <p className="text-sm text-gray-600 mt-1 mb-4">
                    Modify the permissions this role should have.
                  </p>
                  <PermissionMatrix
                    permissions={permissions}
                    selectedPermissionIds={formData.permission_ids}
                    onPermissionChange={handlePermissionChange}
                    compact={true}
                  />
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditDialogOpen(false);
                      resetForm();
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Edit className="h-4 w-4" />
                        Update Role
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};

export default RolePermissionEditor;
