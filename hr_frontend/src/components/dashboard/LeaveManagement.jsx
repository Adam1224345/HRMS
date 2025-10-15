import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Calendar, 
  Plus, 
  Search, 
  Check,
  X,
  Trash2,
  Edit,
  Eye,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const LeaveManagement = () => {
  const { hasRole, user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    leave_type: 'Sick Leave',
    start_date: '',
    end_date: '',
    reason: ''
  });

  const [reviewData, setReviewData] = useState({
    remarks: ''
  });

  const canApproveLeaves = hasRole('Admin') || hasRole('HR');
  const isEmployee = !canApproveLeaves;

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    try {
      const response = await axios.get('/leaves');
      setLeaves(response.data.leaves || []);
      setError('');
    } catch (error) {
      setError('Failed to fetch leave requests');
      console.error('Error fetching leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLeave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      await axios.post('/leaves', formData);
      setIsCreateDialogOpen(false);
      resetForm();
      fetchLeaves();
      setSuccess('Leave request submitted successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to create leave request');
    }
  };

  const handleUpdateLeave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      await axios.put(`/leaves/${selectedLeave.id}`, formData);
      setIsEditDialogOpen(false);
      resetForm();
      fetchLeaves();
      setSuccess('Leave request updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to update leave request');
    }
  };

  const handleApproveLeave = async (leaveId) => {
    setError('');
    setSuccess('');
    
    try {
      await axios.post(`/leaves/${leaveId}/approve`, reviewData);
      setIsReviewDialogOpen(false);
      setReviewData({ remarks: '' });
      fetchLeaves();
      setSuccess('Leave request approved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to approve leave');
    }
  };

  const handleRejectLeave = async (leaveId) => {
    setError('');
    setSuccess('');
    
    try {
      await axios.post(`/leaves/${leaveId}/reject`, reviewData);
      setIsReviewDialogOpen(false);
      setReviewData({ remarks: '' });
      fetchLeaves();
      setSuccess('Leave request rejected successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to reject leave');
    }
  };

  const handleDeleteLeave = async (leaveId) => {
    if (window.confirm('Are you sure you want to delete this leave request?')) {
      setError('');
      setSuccess('');
      
      try {
        await axios.delete(`/leaves/${leaveId}`);
        fetchLeaves();
        setSuccess('Leave request deleted successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } catch (error) {
        setError(error.response?.data?.error || 'Failed to delete leave request');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      leave_type: 'Sick Leave',
      start_date: '',
      end_date: '',
      reason: ''
    });
    setSelectedLeave(null);
  };

  const openEditDialog = (leave) => {
    setSelectedLeave(leave);
    setFormData({
      leave_type: leave.leave_type,
      start_date: leave.start_date,
      end_date: leave.end_date,
      reason: leave.reason
    });
    setIsEditDialogOpen(true);
  };

  const openReviewDialog = (leave) => {
    setSelectedLeave(leave);
    setReviewData({ remarks: leave.remarks || '' });
    setIsReviewDialogOpen(true);
  };

  const openViewDialog = (leave) => {
    setSelectedLeave(leave);
    setIsViewDialogOpen(true);
  };

  const filteredLeaves = leaves.filter(leave => {
    const matchesSearch = 
      leave.leave_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      leave.user?.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      leave.reason.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || leave.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const config = {
      'Pending': { variant: 'secondary', icon: Clock, color: 'text-yellow-600' },
      'Approved': { variant: 'default', icon: CheckCircle2, color: 'text-green-600' },
      'Rejected': { variant: 'destructive', icon: XCircle, color: 'text-red-600' }
    };
    
    const { icon: Icon, color } = config[status] || config['Pending'];
    
    return (
      <Badge variant={config[status]?.variant || 'secondary'} className="flex items-center gap-1">
        <Icon className={`h-3 w-3 ${color}`} />
        {status}
      </Badge>
    );
  };

  const calculateDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const getLeaveTypeColor = (type) => {
    const colors = {
      'Sick Leave': 'bg-red-100 text-red-800 border-red-200',
      'Casual Leave': 'bg-blue-100 text-blue-800 border-blue-200',
      'Vacation': 'bg-purple-100 text-purple-800 border-purple-200',
      'Personal Leave': 'bg-green-100 text-green-800 border-green-200',
      'Emergency Leave': 'bg-orange-100 text-orange-800 border-orange-200'
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // Statistics for HR/Admin
  const stats = canApproveLeaves ? {
    total: leaves.length,
    pending: leaves.filter(l => l.status === 'Pending').length,
    approved: leaves.filter(l => l.status === 'Approved').length,
    rejected: leaves.filter(l => l.status === 'Rejected').length
  } : {
    total: leaves.length,
    pending: leaves.filter(l => l.status === 'Pending').length,
    approved: leaves.filter(l => l.status === 'Approved').length,
    rejected: leaves.filter(l => l.status === 'Rejected').length
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading leave requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Leave Management</h2>
          <p className="text-gray-600 mt-2">
            {canApproveLeaves ? 'Review and manage employee leave requests' : 'Apply for and track your leave requests'}
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Apply for Leave
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Apply for Leave</DialogTitle>
              <DialogDescription>Fill in your leave request details.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateLeave} className="space-y-4">
              <div>
                <Label htmlFor="leave_type">Leave Type</Label>
                <Select 
                  value={formData.leave_type} 
                  onValueChange={(value) => setFormData({...formData, leave_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                    <SelectItem value="Casual Leave">Casual Leave</SelectItem>
                    <SelectItem value="Vacation">Vacation</SelectItem>
                    <SelectItem value="Personal Leave">Personal Leave</SelectItem>
                    <SelectItem value="Emergency Leave">Emergency Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                  rows={3}
                  placeholder="Please provide a reason for your leave..."
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Submit Request</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Success/Error Messages */}
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

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Leave Requests Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Leave Requests</CardTitle>
            <div className="flex gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search leaves..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {canApproveLeaves && <TableHead>Employee</TableHead>}
                <TableHead>Leave Type</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeaves.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canApproveLeaves ? 7 : 6} className="text-center text-gray-500 py-8">
                    No leave requests found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeaves.map((leave) => (
                  <TableRow key={leave.id} className="hover:bg-gray-50">
                    {canApproveLeaves && (
                      <TableCell>
                        <div>
                          <div className="font-medium">{leave.user?.first_name} {leave.user?.last_name}</div>
                          <div className="text-sm text-gray-500">{leave.user?.email}</div>
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge className={getLeaveTypeColor(leave.leave_type)}>
                        {leave.leave_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(leave.start_date).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(leave.end_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{calculateDays(leave.start_date, leave.end_date)} days</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(leave.status)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openViewDialog(leave)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canApproveLeaves && leave.status === 'Pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openReviewDialog(leave)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            Review
                          </Button>
                        )}
                        {isEmployee && leave.status === 'Pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditDialog(leave)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteLeave(leave.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
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

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Leave Request</DialogTitle>
            <DialogDescription>Update your leave request details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateLeave} className="space-y-4">
            <div>
              <Label htmlFor="edit_leave_type">Leave Type</Label>
              <Select 
                value={formData.leave_type} 
                onValueChange={(value) => setFormData({...formData, leave_type: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                  <SelectItem value="Casual Leave">Casual Leave</SelectItem>
                  <SelectItem value="Vacation">Vacation</SelectItem>
                  <SelectItem value="Personal Leave">Personal Leave</SelectItem>
                  <SelectItem value="Emergency Leave">Emergency Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit_start_date">Start Date</Label>
              <Input
                id="edit_start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit_end_date">End Date</Label>
              <Input
                id="edit_end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit_reason">Reason</Label>
              <Textarea
                id="edit_reason"
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                rows={3}
                required
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update Request</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Leave Request Details</DialogTitle>
          </DialogHeader>
          {selectedLeave && (
            <div className="space-y-4">
              {canApproveLeaves && (
                <div>
                  <Label className="text-gray-600">Employee</Label>
                  <p className="font-medium">{selectedLeave.user?.first_name} {selectedLeave.user?.last_name}</p>
                  <p className="text-sm text-gray-500">{selectedLeave.user?.email}</p>
                </div>
              )}
              <div>
                <Label className="text-gray-600">Leave Type</Label>
                <p className="font-medium">{selectedLeave.leave_type}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-600">Start Date</Label>
                  <p className="font-medium">{new Date(selectedLeave.start_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-gray-600">End Date</Label>
                  <p className="font-medium">{new Date(selectedLeave.end_date).toLocaleDateString()}</p>
                </div>
              </div>
              <div>
                <Label className="text-gray-600">Duration</Label>
                <p className="font-medium">{calculateDays(selectedLeave.start_date, selectedLeave.end_date)} days</p>
              </div>
              <div>
                <Label className="text-gray-600">Status</Label>
                <div className="mt-1">{getStatusBadge(selectedLeave.status)}</div>
              </div>
              <div>
                <Label className="text-gray-600">Reason</Label>
                <p className="text-sm mt-1">{selectedLeave.reason}</p>
              </div>
              {selectedLeave.remarks && (
                <div>
                  <Label className="text-gray-600">Remarks</Label>
                  <p className="text-sm mt-1">{selectedLeave.remarks}</p>
                </div>
              )}
              {selectedLeave.reviewed_by && (
                <div>
                  <Label className="text-gray-600">Reviewed By</Label>
                  <p className="text-sm mt-1">{selectedLeave.reviewed_by.first_name} {selectedLeave.reviewed_by.last_name}</p>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review Leave Request</DialogTitle>
            <DialogDescription>
              {selectedLeave && (
                <div className="mt-4 space-y-2 text-sm">
                  <p><strong>Employee:</strong> {selectedLeave.user?.first_name} {selectedLeave.user?.last_name}</p>
                  <p><strong>Leave Type:</strong> {selectedLeave.leave_type}</p>
                  <p><strong>Duration:</strong> {new Date(selectedLeave.start_date).toLocaleDateString()} to {new Date(selectedLeave.end_date).toLocaleDateString()}</p>
                  <p><strong>Days:</strong> {calculateDays(selectedLeave.start_date, selectedLeave.end_date)} days</p>
                  <p><strong>Reason:</strong> {selectedLeave.reason}</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="remarks">Remarks (Optional)</Label>
              <Textarea
                id="remarks"
                value={reviewData.remarks}
                onChange={(e) => setReviewData({...reviewData, remarks: e.target.value})}
                rows={3}
                placeholder="Add any comments or notes..."
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsReviewDialogOpen(false);
                  setReviewData({ remarks: '' });
                }}
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                variant="destructive"
                onClick={() => selectedLeave && handleRejectLeave(selectedLeave.id)}
              >
                <X className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button 
                type="button"
                onClick={() => selectedLeave && handleApproveLeave(selectedLeave.id)}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4 mr-2" />
                Approve
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaveManagement;

