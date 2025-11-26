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
  Clock,
  Upload,
  FileText,
  Image,
  XCircle as XCircleIcon,
  Download // Imported Download icon
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useDropzone } from 'react-dropzone';

// ---------------------------------------------------------------
// SAFE AXIOS BASE URL – works on localhost **and** Vercel
// ---------------------------------------------------------------
if (!axios.defaults.baseURL) {
  const isDev = process.env.NODE_ENV === 'development';
  axios.defaults.baseURL = isDev ? 'http://localhost:5000/api' : '/api';
}

const BACKEND_ROOT_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:5000' 
  : window.location.origin;


const LeaveManagement = () => {
  const { hasRole, user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Dialog States
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const [selectedLeave, setSelectedLeave] = useState(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const [formData, setFormData] = useState({
    leave_type: 'Sick Leave',
    start_date: '',
    end_date: '',
    reason: '',
  });

  // --- NEW STATE: Smart Leave Analysis ---
  const [dateAnalysis, setDateAnalysis] = useState({
    loading: false,
    overlap: false,
    overlap_msg: null,
    suggestions: [],
    holidays: []
  });

  const [reviewData, setReviewData] = useState({
    remarks: '',
  });

  // File states
  const [createFiles, setCreateFiles] = useState([]);
  const [editFiles, setEditFiles] = useState([]);
  
  // State to hold documents fetched separately
  const [viewDocuments, setViewDocuments] = useState([]);

  const canApproveLeaves = hasRole('Admin') || hasRole('HR');
  const isEmployee = !canApproveLeaves;

  useEffect(() => {
    fetchLeaves();
  }, [page]);

  // --- NEW EFFECT: Trigger Analysis when dates change ---
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.start_date && formData.end_date) {
        analyzeDates(formData.start_date, formData.end_date);
      } else {
        // Reset analysis if dates are cleared
        setDateAnalysis({ loading: false, overlap: false, suggestions: [], holidays: [] });
      }
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [formData.start_date, formData.end_date]);


  // --- NEW FUNCTION: Call Backend for Smart Suggestions ---
  const analyzeDates = async (start, end) => {
    if (!start || !end) return;
    if (new Date(end) < new Date(start)) return;

    setDateAnalysis(prev => ({ ...prev, loading: true }));

    try {
      const response = await axios.post('/leaves/analyze-dates', {
        start_date: start,
        end_date: end
      });
      setDateAnalysis({ ...response.data, loading: false });
    } catch (error) {
      console.error("Analysis failed", error);
      setDateAnalysis(prev => ({ ...prev, loading: false }));
    }
  };


  const fetchLeaves = async (resetFilters = false) => {
    try {
      setLoading(true);
      const currentSearchTerm = resetFilters ? '' : searchTerm;
      const currentStatusFilter = resetFilters ? 'all' : statusFilter;

      const response = await axios.get('/leaves', {
        params: {
          page,
          per_page: perPage,
          status: currentStatusFilter === 'all' ? undefined : currentStatusFilter,
        },
      });

      const { leaves, total, pages } = response.data;
      setLeaves(leaves || []);
      setTotalPages(pages || 1);
      if (resetFilters) {
        setSearchTerm('');
        setStatusFilter('all');
        setPage(1);
      }
      setError('');
    } catch (error) {
      setError('Failed to fetch leave requests');
      console.error('Error fetching leaves:', error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch documents specifically for one leave
  const fetchDocumentsForLeave = async (leaveId) => {
    setViewDocuments([]); // Clear previous docs
    try {
      const response = await axios.get(`/documents/leave/${leaveId}`);
      setViewDocuments(response.data);
    } catch (err) {
      console.error("Could not fetch documents for this leave", err);
    }
  };

  // Upload function using Promise.all
  const uploadDocuments = async (leaveId, files) => {
    if (!files || files.length === 0) return;

    const uploadPromises = files.map(file => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('purpose', 'supporting_document');
      formData.append('leave_id', leaveId);

      return axios.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    });

    try {
      await Promise.all(uploadPromises);
    } catch (err) {
      console.error('Document upload failed:', err);
      setError('Leave saved, but some documents failed to upload.');
    }
  };

  const handleCreateLeave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Prevent submission if overlap exists
    if (dateAnalysis.overlap) {
      setError("Cannot submit: Date overlap detected.");
      return;
    }

    try {
      const response = await axios.post('/leaves', formData);
      const leaveId = response.data.id;

      await uploadDocuments(leaveId, createFiles);

      setIsCreateDialogOpen(false);
      resetForm();
      setCreateFiles([]);
      await fetchLeaves(true);
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
      await uploadDocuments(selectedLeave.id, editFiles);

      setIsEditDialogOpen(false);
      resetForm();
      setEditFiles([]);
      await fetchLeaves(true);
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
      await fetchLeaves(true);
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
      await fetchLeaves(true);
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
        await fetchLeaves(true);
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
      reason: '',
    });
    // Reset analysis state
    setDateAnalysis({ loading: false, overlap: false, suggestions: [], holidays: [] });
    setSelectedLeave(null);
    setCreateFiles([]);
    setEditFiles([]);
    setViewDocuments([]); 
  };

  const openEditDialog = async (leave) => {
    setSelectedLeave(leave);
    setFormData({
      leave_type: leave.leave_type,
      start_date: leave.start_date,
      end_date: leave.end_date,
      reason: leave.reason,
    });
    setEditFiles([]);
    await fetchDocumentsForLeave(leave.id);
    setIsEditDialogOpen(true);
  };

  const openReviewDialog = async (leave) => {
    setSelectedLeave(leave);
    setReviewData({ remarks: leave.remarks || '' });
    await fetchDocumentsForLeave(leave.id);
    setIsReviewDialogOpen(true);
  };

  const openViewDialog = async (leave) => {
    setSelectedLeave(leave);
    await fetchDocumentsForLeave(leave.id);
    setIsViewDialogOpen(true);
  };

  // --- SECURE DOWNLOAD FUNCTION ---
  const openFile = async (downloadUrl, fileName) => {
    if (!downloadUrl) return;

    try {
      const token = localStorage.getItem('token');
      const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `${BACKEND_ROOT_URL}${downloadUrl}`;

      const response = await axios.get(fullUrl, {
        responseType: 'blob', 
        headers: {
          Authorization: `Bearer ${token}` 
        }
      });
      
      if (response.headers['content-type'] && response.headers['content-type'].includes('application/json')) {
         const textData = await response.data.text();
         const jsonError = JSON.parse(textData);
         alert(jsonError.error || "Download failed");
         return;
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName || 'document');
      document.body.appendChild(link);
      link.click();
      
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error("Download failed:", err);
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        alert("Unauthorized to download this file.");
      } else {
        alert("Failed to download file. Please try again.");
      }
    }
  };

  const {
    getRootProps: getCreateRootProps,
    getInputProps: getCreateInputProps,
    isDragActive: isCreateDragActive,
  } = useDropzone({
    onDrop: (acceptedFiles) => setCreateFiles(acceptedFiles),
    accept: { 'image/*': [], 'application/pdf': [], 'application/msword': [], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [] },
    maxSize: 10 * 1024 * 1024,
  });

  const {
    getRootProps: getEditRootProps,
    getInputProps: getEditInputProps,
    isDragActive: isEditDragActive,
  } = useDropzone({
    onDrop: (acceptedFiles) => setEditFiles(acceptedFiles),
    accept: { 'image/*': [], 'application/pdf': [], 'application/msword': [], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [] },
    maxSize: 10 * 1024 * 1024,
  });

  const filteredLeaves = leaves.filter((leave) => {
    const matchesSearch =
      leave.leave_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (leave.user?.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      leave.reason.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || leave.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const config = {
      Pending: { variant: 'secondary', icon: Clock, color: 'text-yellow-600' },
      Approved: { variant: 'default', icon: CheckCircle2, color: 'text-green-600' },
      Rejected: { variant: 'destructive', icon: XCircle, color: 'text-red-600' },
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
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const getLeaveTypeColor = (type) => {
    const colors = {
      'Sick Leave': 'bg-red-100 text-red-800 border-red-200',
      'Casual Leave': 'bg-blue-100 text-blue-800 border-blue-200',
      'Vacation': 'bg-purple-100 text-purple-800 border-purple-200',
      'Personal Leave': 'bg-green-100 text-green-800 border-green-200',
      'Emergency Leave': 'bg-orange-100 text-orange-800 border-orange-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const stats = {
    total: leaves.length,
    pending: leaves.filter((l) => l.status === 'Pending').length,
    approved: leaves.filter((l) => l.status === 'Approved').length,
    rejected: leaves.filter((l) => l.status === 'Rejected').length,
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

  // --- REUSABLE DOCUMENT LIST COMPONENT ---
  const DocumentList = ({ documents }) => {
    if (!documents || documents.length === 0) return (
      <div className="mt-2 p-3 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center">
        <p className="text-sm text-gray-500">No documents attached.</p>
      </div>
    );

    return (
      <div className="mt-2 grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
        {documents.map((doc, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              {doc.original_name?.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                 <Image className="h-5 w-5 text-blue-600 flex-shrink-0" />
              ) : (
                 <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-gray-900 truncate max-w-[180px]" title={doc.original_name}>
                  {doc.original_name}
                </span>
              </div>
            </div>
            {/* Download Button */}
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => openFile(doc.download_url, doc.original_name)}
              className="text-gray-500 hover:text-blue-600 hover:bg-blue-50"
              title="Download/View"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
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
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Apply for Leave</DialogTitle>
              <DialogDescription>Fill in your leave request details.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateLeave} className="space-y-4">
              <div>
                <Label htmlFor="leave_type">Leave Type</Label>
                <Select value={formData.leave_type} onValueChange={(value) => setFormData({ ...formData, leave_type: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                    <SelectItem value="Casual Leave">Casual Leave</SelectItem>
                    <SelectItem value="Vacation">Vacation</SelectItem>
                    <SelectItem value="Personal Leave">Personal Leave</SelectItem>
                    <SelectItem value="Emergency Leave">Emergency Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* DATE INPUTS */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input id="start_date" type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="end_date">End Date</Label>
                  <Input id="end_date" type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} required />
                </div>
              </div>

              {/* === SMART SUGGESTIONS BLOCK START === */}
              {(formData.start_date && formData.end_date) && (
                <div className="mt-3 space-y-2">
                  {dateAnalysis.loading && <p className="text-xs text-gray-400">Analyzing dates...</p>}
                  
                  {/* 1. OVERLAP WARNING (Red) */}
                  {dateAnalysis.overlap && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3 flex gap-2">
                      <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                      <p className="text-xs text-red-800 font-medium">{dateAnalysis.overlap_msg}</p>
                    </div>
                  )}

                  {/* 2. HOLIDAY INFO (Green) */}
                  {dateAnalysis.holidays.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-md p-3 flex gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                      <div className="text-xs text-green-800">
                        <p className="font-medium">Includes Public Holidays:</p>
                        <ul className="list-disc pl-4 mt-1">
                          {dateAnalysis.holidays.map((h, i) => (
                            <li key={i}>{h.name} ({h.date})</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* 3. BRIDGE SUGGESTIONS (Blue) */}
                  {!dateAnalysis.overlap && dateAnalysis.suggestions.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2">
                      <Clock className="h-5 w-5 text-blue-600 shrink-0" />
                      <div className="text-xs text-blue-800">
                        <p className="font-medium">Smart Suggestions:</p>
                        <ul className="list-disc pl-4 mt-1">
                          {dateAnalysis.suggestions.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* === SMART SUGGESTIONS BLOCK END === */}

              <div>
                <Label htmlFor="reason">Reason</Label>
                <Textarea id="reason" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} rows={3} placeholder="Reason..." required />
              </div>

              {/* Upload Section - Create */}
              <div>
                <Label>Supporting Documents (Optional)</Label>
                <div {...getCreateRootProps()} className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${isCreateDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}>
                  <input {...getCreateInputProps()} />
                  <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">{isCreateDragActive ? "Drop files here..." : "Drag & drop files here, or click to select"}</p>
                </div>
                {createFiles.length > 0 && (
                  <div className="mt-4 max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-gray-50 p-3 scrollbar-thin scrollbar-thumb-gray-400">
                    <div className="space-y-2">
                      {createFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="h-9 w-9 text-gray-600 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                              <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                          <button type="button" onClick={() => setCreateFiles(prev => prev.filter((_, i) => i !== index))} className="text-red-600 hover:bg-red-50 p-2 rounded-full">
                            <XCircleIcon className="h-5 w-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <Button type="button" variant="outline" onClick={() => { setIsCreateDialogOpen(false); setCreateFiles([]); resetForm(); }}>Cancel</Button>
                <Button type="submit" disabled={dateAnalysis.overlap}>Submit Request</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="border-green-200 bg-green-50"><CheckCircle2 className="h-4 w-4 text-green-600" /><AlertDescription className="text-green-800">{success}</AlertDescription></Alert>}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-600">Total</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-yellow-600">Pending</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-yellow-600">{stats.pending}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-600">Approved</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{stats.approved}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-red-600">Rejected</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{stats.rejected}</div></CardContent></Card>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center">
        <Button disabled={page === 1} onClick={() => setPage((prev) => prev - 1)} variant="outline">Previous</Button>
        <span>Page {page} of {totalPages}</span>
        <Button disabled={page === totalPages} onClick={() => setPage((prev) => prev + 1)} variant="outline">Next</Button>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Leave Requests</CardTitle>
            <div className="flex gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
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
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeaves.length === 0 ? (
                <TableRow><TableCell colSpan={canApproveLeaves ? 7 : 6} className="text-center text-gray-500 py-8">No leave requests found</TableCell></TableRow>
              ) : (
                filteredLeaves.map((leave) => (
                  <TableRow key={leave.id} className="hover:bg-gray-50">
                    {canApproveLeaves && (
                      <TableCell>
                        <div><div className="font-medium">{leave.user?.first_name} {leave.user?.last_name}</div><div className="text-sm text-gray-500">{leave.user?.email}</div></div>
                      </TableCell>
                    )}
                    <TableCell><Badge className={getLeaveTypeColor(leave.leave_type)}>{leave.leave_type}</Badge></TableCell>
                    <TableCell>{new Date(leave.start_date).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(leave.end_date).toLocaleDateString()}</TableCell>
                    <TableCell><Badge variant="outline">{calculateDays(leave.start_date, leave.end_date)} days</Badge></TableCell>
                    <TableCell>{getStatusBadge(leave.status)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline" onClick={() => openViewDialog(leave)}><Eye className="h-4 w-4" /></Button>
                        {canApproveLeaves && leave.status === 'Pending' && <Button size="sm" variant="outline" onClick={() => openReviewDialog(leave)} className="text-blue-600 hover:text-blue-800">Review</Button>}
                        {isEmployee && leave.status === 'Pending' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => openEditDialog(leave)}><Edit className="h-4 w-4" /></Button>
                            <Button size="sm" variant="outline" onClick={() => handleDeleteLeave(leave.id)} className="text-red-600 hover:text-red-800"><Trash2 className="h-4 w-4" /></Button>
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Leave Request</DialogTitle><DialogDescription>Update your details.</DialogDescription></DialogHeader>
          <form onSubmit={handleUpdateLeave} className="space-y-4">
             <div>
                <Label htmlFor="edit_leave_type">Leave Type</Label>
                <Select value={formData.leave_type} onValueChange={(value) => setFormData({ ...formData, leave_type: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Input id="edit_start_date" type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="edit_end_date">End Date</Label>
                <Input id="edit_end_date" type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="edit_reason">Reason</Label>
                <Textarea id="edit_reason" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} rows={3} required />
              </div>

             {/* Documents - Upload New */}
             <div>
                <Label>Add More Documents (Optional)</Label>
                <div {...getEditRootProps()} className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${isEditDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}>
                  <input {...getEditInputProps()} />
                  <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">Click or Drag to add files</p>
                </div>
                {/* Upload Queue */}
                {editFiles.length > 0 && (
                   <div className="mt-4 mb-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-gray-50 p-3">
                     {editFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-gray-100 mb-2">
                          <span className="truncate">{file.name}</span>
                          <button type="button" onClick={() => setEditFiles(prev => prev.filter((_, i) => i !== index))} className="text-red-600"><XCircleIcon className="h-5 w-5" /></button>
                        </div>
                     ))}
                   </div>
                )}
             </div>

             {/* Existing Documents in Edit Mode */}
             <div>
               <Label className="text-gray-600">Existing Documents</Label>
               <DocumentList documents={viewDocuments} />
             </div>

             <div className="flex justify-end space-x-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditFiles([]); }}>Cancel</Button>
              <Button type="submit">Update Request</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Leave Request Details</DialogTitle></DialogHeader>
          {selectedLeave && (
            <div className="space-y-4">
              {canApproveLeaves && (
                <div>
                  <Label className="text-gray-600">Employee</Label>
                  <p className="font-medium">{selectedLeave.user?.first_name} {selectedLeave.user?.last_name}</p>
                </div>
              )}
              <div><Label className="text-gray-600">Leave Type</Label><p className="font-medium">{selectedLeave.leave_type}</p></div>
              <div><Label className="text-gray-600">Reason</Label><p className="text-sm mt-1">{selectedLeave.reason}</p></div>
              
              {/* DOCUMENTS LIST */}
              <div><Label className="text-gray-600">Attached Documents</Label><DocumentList documents={viewDocuments} /></div>
              
              {selectedLeave.remarks && <div><Label className="text-gray-600">Remarks</Label><p className="text-sm mt-1">{selectedLeave.remarks}</p></div>}
            </div>
          )}
          <div className="flex justify-end pt-2"><Button onClick={() => setIsViewDialogOpen(false)}>Close</Button></div>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Review Leave Request</DialogTitle>
            <DialogDescription>
              {selectedLeave && (
                <div className="mt-4 space-y-2 text-sm">
                  <p><strong>Employee:</strong> {selectedLeave.user?.first_name} {selectedLeave.user?.last_name}</p>
                  <p><strong>Reason:</strong> {selectedLeave.reason}</p>
                  
                  {/* DOCUMENTS LIST */}
                  <div className="pt-2"><strong>Attached Documents:</strong><DocumentList documents={viewDocuments} /></div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label htmlFor="remarks">Remarks</Label><Textarea id="remarks" value={reviewData.remarks} onChange={(e) => setReviewData({ ...reviewData, remarks: e.target.value })} rows={3} /></div>
            <div className="flex justify-end space-x-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setIsReviewDialogOpen(false); setReviewData({ remarks: '' }); }}>Cancel</Button>
              <Button type="button" variant="destructive" onClick={() => selectedLeave && handleRejectLeave(selectedLeave.id)}><X className="h-4 w-4 mr-2" />Reject</Button>
              <Button type="button" onClick={() => selectedLeave && handleApproveLeave(selectedLeave.id)} className="bg-green-600 hover:bg-green-700"><Check className="h-4 w-4 mr-2" />Approve</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaveManagement;