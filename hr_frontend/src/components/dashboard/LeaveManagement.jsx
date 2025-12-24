import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';
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
  Download
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useDropzone } from 'react-dropzone';

if (!axios.defaults.baseURL) {
  const isDev = process.env.NODE_ENV === 'development';
  axios.defaults.baseURL = isDev ? 'http://localhost:5000/api' : '/api';
}

const BACKEND_ROOT_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:5000' 
  : window.location.origin;

const LEAVE_TYPES = [
    'Sick Leave', 
    'Casual Leave', 
    'Vacation', 
    'Personal Leave', 
    'Emergency Leave'
];

const STATUS_MAP = {
    Pending: { variant: 'secondary', icon: Clock, color: 'text-yellow-600' },
    Approved: { variant: 'default', icon: CheckCircle2, color: 'text-green-600' },
    Rejected: { variant: 'destructive', icon: XCircle, color: 'text-red-600' },
};

// --- Helper Component: Document List (Fixes Visibility & URL Issues) ---
const DocumentList = ({ documents, onDownload, t }) => {
  if (!documents || documents.length === 0) return (
    <div className="mt-2 p-3 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center">
      <p className="text-sm text-gray-500">{t('no_documents_attached')}</p>
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
          <Button
            variant="ghost"
            size="sm"
            type="button"
            // Pass the whole doc object so we can construct the URL if needed
            onClick={(e) => {
                e.preventDefault();
                onDownload(doc);
            }}
            className="text-gray-500 hover:text-blue-600 hover:bg-blue-50"
            title={t('download_view')}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
};

const LeaveManagement = () => {
  const { t } = useTranslation();
  const { hasRole, user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const [selectedLeave, setSelectedLeave] = useState(null);
  
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const [formData, setFormData] = useState({
    leave_type: 'Sick Leave',
    start_date: '',
    end_date: '',
    reason: '',
  });

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

  const [createFiles, setCreateFiles] = useState([]);
  const [editFiles, setEditFiles] = useState([]);
  
  const [viewDocuments, setViewDocuments] = useState([]);

  const canApproveLeaves = hasRole('Admin') || hasRole('HR');
  const isEmployee = !canApproveLeaves;

  useEffect(() => {
    fetchLeaves();
  }, [page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.start_date && formData.end_date) {
        analyzeDates(formData.start_date, formData.end_date);
      } else {
        setDateAnalysis({ loading: false, overlap: false, suggestions: [], holidays: [] });
      }
    }, 500); 
    return () => clearTimeout(timer);
  }, [formData.start_date, formData.end_date]);

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
      setError(t('error_fetch_leave_requests'));
      console.error('Error fetching leaves:', error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocumentsForLeave = async (leaveId) => {
    setViewDocuments([]); // Clear previous documents immediately
    try {
      const response = await axios.get(`/documents/leave/${leaveId}`);
      // Ensure we always set an array, even if response is null/undefined
      setViewDocuments(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Could not fetch documents for this leave", err);
      setViewDocuments([]);
    }
  };

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
      setError(t('error_doc_upload_failed'));
    }
  };

  const handleCreateLeave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (dateAnalysis.overlap) {
      setError(t('error_date_overlap_detected'));
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
      setSuccess(t('success_leave_submitted'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.error || t('error_create_leave_failed'));
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
      setSuccess(t('success_leave_updated'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.error || t('error_update_leave_failed'));
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
      setSuccess(t('success_leave_approved'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.error || t('error_approve_leave_failed'));
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
      setSuccess(t('success_leave_rejected'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.error || t('error_reject_leave_failed'));
    }
  };

  const handleDeleteLeave = async (leaveId) => {
    if (window.confirm(t('confirm_delete_leave'))) {
      setError('');
      setSuccess('');
      try {
        await axios.delete(`/leaves/${leaveId}`);
        await fetchLeaves(true);
        setSuccess(t('success_leave_deleted'));
        setTimeout(() => setSuccess(''), 3000);
      } catch (error) {
        setError(error.response?.data?.error || t('error_delete_leave_failed'));
      }
    }
  };

  const resetForm = () => {
    setFormData({
      leave_type: LEAVE_TYPES[0], 
      start_date: '',
      end_date: '',
      reason: '',
    });
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
    // Ensure documents are fetched
    await fetchDocumentsForLeave(leave.id);
    setIsEditDialogOpen(true);
  };

  const openReviewDialog = async (leave) => {
    setSelectedLeave(leave);
    setReviewData({ remarks: leave.remarks || '' });
    // Ensure documents are fetched
    await fetchDocumentsForLeave(leave.id);
    setIsReviewDialogOpen(true);
  };

  const openViewDialog = async (leave) => {
    setSelectedLeave(leave);
    // Ensure documents are fetched
    await fetchDocumentsForLeave(leave.id);
    setIsViewDialogOpen(true);
  };

  // --- UPDATED: Robust File Opening ---
  const openFile = async (doc) => {
    // 1. Construct URL if missing from backend response (Very common issue)
    let downloadUrl = doc.download_url;
    if (!downloadUrl && doc.id) {
        downloadUrl = `/documents/download/${doc.id}`;
    }

    if (!downloadUrl) {
        alert(t('error_file_url_missing'));
        return;
    }

    try {
      const token = localStorage.getItem('token');
      const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `${BACKEND_ROOT_URL}${downloadUrl}`;

      const response = await axios.get(fullUrl, {
        responseType: 'blob', 
        headers: {
          Authorization: `Bearer ${token}` 
        }
      });
      
      // Check if backend returned JSON error instead of blob
      if (response.headers['content-type'] && response.headers['content-type'].includes('application/json')) {
         const textData = await response.data.text();
         const jsonError = JSON.parse(textData);
         alert(jsonError.error || t('alert_download_failed'));
         return;
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      // Use original name or fallback
      link.setAttribute('download', doc.original_name || `document_${doc.id}`);
      document.body.appendChild(link);
      link.click();
      
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error("Download failed:", err);
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        alert(t('alert_unauthorized_download'));
      } else if (err.response && err.response.status === 404) {
        alert(t('error_file_not_found_server'));
      } else {
        alert(t('alert_download_generic_fail'));
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
    const { icon: Icon, color } = STATUS_MAP[status] || STATUS_MAP['Pending'];
    return (
      <Badge variant={STATUS_MAP[status]?.variant || 'secondary'} className="flex items-center gap-1 w-fit">
        <Icon className={`h-3 w-3 ${color}`} />
        {t(`status_${status.toLowerCase()}`)}
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
          <p className="text-gray-600">{t('loading_leave_requests')}</p>
        </div>
      </div>
    );
  }

  // --- RESPONSIVE CARD ITEM (For Mobile View) ---
  const MobileLeaveCard = ({ leave }) => (
    <Card className="mb-4 shadow-sm border-gray-200">
      <CardHeader className="pb-2 bg-gray-50/50 rounded-t-xl border-b border-gray-100">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-semibold text-gray-900">{t(`leave_type_${leave.leave_type.replace(' ', '_').toLowerCase()}`)}</div>
            {canApproveLeaves && (
              <div className="text-sm text-gray-500 mt-1">
                {leave.user?.first_name} {leave.user?.last_name}
              </div>
            )}
          </div>
          {getStatusBadge(leave.status)}
        </div>
      </CardHeader>
      <CardContent className="pt-4 grid gap-2 text-sm">
        <div className="flex justify-between">
            <span className="text-gray-500">{t('duration')}:</span>
            <span className="font-medium">
                {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
            </span>
        </div>
        <div className="flex justify-between">
            <span className="text-gray-500">{t('days')}:</span>
            <span className="font-medium">{calculateDays(leave.start_date, leave.end_date)} {t('days_unit')}</span>
        </div>
      </CardContent>
      <CardFooter className="pt-2 flex justify-end gap-2 border-t bg-gray-50/30">
          <Button size="sm" variant="outline" onClick={() => openViewDialog(leave)} title={t('view')}>
            <Eye className="h-4 w-4" />
          </Button>
          {canApproveLeaves && leave.status === 'Pending' && (
            <Button size="sm" variant="outline" onClick={() => openReviewDialog(leave)} className="text-blue-600 border-blue-200 hover:bg-blue-50">
                {t('review')}
            </Button>
          )}
          {isEmployee && leave.status === 'Pending' && (
            <>
              <Button size="sm" variant="outline" onClick={() => openEditDialog(leave)} title={t('edit')}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDeleteLeave(leave.id)} className="text-red-600 border-red-200 hover:bg-red-50" title={t('delete')}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
      </CardFooter>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">{t('leave_management_title')}</h2>
          <p className="text-sm md:text-base text-gray-600 mt-1">
            {canApproveLeaves ? t('leave_management_desc_admin') : t('leave_management_desc_employee')}
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full md:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              {t('apply_for_leave_btn')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('apply_for_leave_title')}</DialogTitle>
              <DialogDescription>{t('fill_leave_details')}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateLeave} className="space-y-4">
              <div>
                <Label htmlFor="leave_type">{t('leave_type_label')}</Label>
                <Select value={formData.leave_type} onValueChange={(value) => setFormData({ ...formData, leave_type: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{t(`leave_type_${type.replace(' ', '_').toLowerCase()}`)}</SelectItem> 
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">{t('start_date')}</Label>
                  <Input id="start_date" type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="end_date">{t('end_date')}</Label>
                  <Input id="end_date" type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} required />
                </div>
              </div>

              {(formData.start_date && formData.end_date) && (
                <div className="mt-3 space-y-2">
                  {dateAnalysis.loading && <p className="text-xs text-gray-400">{t('analyzing_dates')}...</p>}
                  
                  {dateAnalysis.overlap && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3 flex gap-2">
                      <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                      <p className="text-xs text-red-800 font-medium">{dateAnalysis.overlap_msg}</p>
                    </div>
                  )}

                  {dateAnalysis.holidays.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-md p-3 flex gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                      <div className="text-xs text-green-800">
                        <p className="font-medium">{t('includes_public_holidays')}:</p>
                        <ul className="list-disc pl-4 mt-1">
                          {dateAnalysis.holidays.map((h, i) => (
                            <li key={i}>{h.name} ({h.date})</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {!dateAnalysis.overlap && dateAnalysis.suggestions.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2">
                      <Clock className="h-5 w-5 text-blue-600 shrink-0" />
                      <div className="text-xs text-blue-800">
                        <p className="font-medium">{t('smart_suggestions')}:</p>
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

              <div>
                <Label htmlFor="reason">{t('reason_label')}</Label>
                <Textarea id="reason" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} rows={3} placeholder={t('reason_placeholder')} required />
              </div>

              <div>
                <Label>{t('supporting_docs_label')}</Label>
                <div {...getCreateRootProps()} className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${isCreateDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}>
                  <input {...getCreateInputProps()} />
                  <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">{isCreateDragActive ? t('drop_files_here') : t('drag_drop_files')}</p>
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
                              <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} {t('mb_unit')}</p>
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
                <Button type="button" variant="outline" onClick={() => { setIsCreateDialogOpen(false); setCreateFiles([]); resetForm(); }}>{t('cancel')}</Button>
                <Button type="submit" disabled={dateAnalysis.overlap}>{t('submit_request')}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="border-green-200 bg-green-50"><CheckCircle2 className="h-4 w-4 text-green-600" /><AlertDescription className="text-green-800">{success}</AlertDescription></Alert>}

      {/* Stats Cards - Responsive Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2 p-4"><CardTitle className="text-xs md:text-sm font-medium text-gray-600">{t('stat_total')}</CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className="text-xl md:text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardHeader className="pb-2 p-4"><CardTitle className="text-xs md:text-sm font-medium text-yellow-600">{t('stat_pending')}</CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className="text-xl md:text-2xl font-bold text-yellow-600">{stats.pending}</div></CardContent></Card>
        <Card><CardHeader className="pb-2 p-4"><CardTitle className="text-xs md:text-sm font-medium text-green-600">{t('stat_approved')}</CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className="text-xl md:text-2xl font-bold text-green-600">{stats.approved}</div></CardContent></Card>
        <Card><CardHeader className="pb-2 p-4"><CardTitle className="text-xs md:text-sm font-medium text-red-600">{t('stat_rejected')}</CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className="text-xl md:text-2xl font-bold text-red-600">{stats.rejected}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <CardTitle>{t('leave_requests_title')}</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_status')}</SelectItem>
                  <SelectItem value="Pending">{t('status_pending')}</SelectItem>
                  <SelectItem value="Approved">{t('status_approved')}</SelectItem>
                  <SelectItem value="Rejected">{t('status_rejected')}</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder={t('search_placeholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
            
          {/* Mobile View (Cards) - Hidden on desktop */}
          <div className="md:hidden space-y-4 p-4 pt-0">
             {filteredLeaves.length === 0 ? (
                <p className="text-center text-gray-500 py-8">{t('no_leave_requests_found')}</p>
             ) : (
                filteredLeaves.map(leave => <MobileLeaveCard key={leave.id} leave={leave} />)
             )}
          </div>

          {/* Desktop View (Table) - Hidden on mobile */}
          <div className="hidden md:block">
            <Table>
                <TableHeader>
                <TableRow>
                    {canApproveLeaves && <TableHead>{t('employee')}</TableHead>}
                    <TableHead>{t('leave_type')}</TableHead>
                    <TableHead>{t('start_date_head')}</TableHead>
                    <TableHead>{t('end_date_head')}</TableHead>
                    <TableHead>{t('days')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead>{t('actions')}</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {filteredLeaves.length === 0 ? (
                    <TableRow><TableCell colSpan={canApproveLeaves ? 7 : 6} className="text-center text-gray-500 py-8">{t('no_leave_requests_found')}</TableCell></TableRow>
                ) : (
                    filteredLeaves.map((leave) => (
                    <TableRow key={leave.id} className="hover:bg-gray-50">
                        {canApproveLeaves && (
                        <TableCell>
                            <div><div className="font-medium">{leave.user?.first_name} {leave.user?.last_name}</div><div className="text-sm text-gray-500">{leave.user?.email}</div></div>
                        </TableCell>
                        )}
                        <TableCell><Badge className={getLeaveTypeColor(leave.leave_type)}>{t(`leave_type_${leave.leave_type.replace(' ', '_').toLowerCase()}`)}</Badge></TableCell>
                        <TableCell>{new Date(leave.start_date).toLocaleDateString(t('locale'))}</TableCell>
                        <TableCell>{new Date(leave.end_date).toLocaleDateString(t('locale'))}</TableCell>
                        <TableCell><Badge variant="outline">{calculateDays(leave.start_date, leave.end_date)} {t('days_unit')}</Badge></TableCell>
                        <TableCell>{getStatusBadge(leave.status)}</TableCell>
                        <TableCell>
                        <div className="flex space-x-2">
                            <Button size="sm" variant="outline" onClick={() => openViewDialog(leave)} title={t('view')}><Eye className="h-4 w-4" /></Button>
                            {canApproveLeaves && leave.status === 'Pending' && <Button size="sm" variant="outline" onClick={() => openReviewDialog(leave)} className="text-blue-600 hover:text-blue-800" title={t('review_leave')}>{t('review_leave')}</Button>}
                            {isEmployee && leave.status === 'Pending' && (
                            <>
                                <Button size="sm" variant="outline" onClick={() => openEditDialog(leave)} title={t('edit')}><Edit className="h-4 w-4" /></Button>
                                <Button size="sm" variant="outline" onClick={() => handleDeleteLeave(leave.id)} className="text-red-600 hover:text-red-800" title={t('delete')}><Trash2 className="h-4 w-4" /></Button>
                            </>
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

      <div className="flex justify-between items-center px-2">
        <Button disabled={page === 1} onClick={() => setPage((prev) => prev - 1)} variant="outline" size="sm">{t('previous')}</Button>
        <span className="text-sm text-gray-600">{t('page_of_total', { page, total: totalPages })}</span>
        <Button disabled={page === totalPages} onClick={() => setPage((prev) => prev + 1)} variant="outline" size="sm">{t('next')}</Button>
      </div>

      {/* --- DIALOGS (Responsive Max Width) --- */}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('edit_leave_request')}</DialogTitle><DialogDescription>{t('update_your_details')}</DialogDescription></DialogHeader>
          <form onSubmit={handleUpdateLeave} className="space-y-4">
             <div>
                <Label htmlFor="edit_leave_type">{t('leave_type_label')}</Label>
                <Select value={formData.leave_type} onValueChange={(value) => setFormData({ ...formData, leave_type: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{t(`leave_type_${type.replace(' ', '_').toLowerCase()}`)}</SelectItem> 
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit_start_date">{t('start_date')}</Label>
                <Input id="edit_start_date" type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="edit_end_date">{t('end_date')}</Label>
                <Input id="edit_end_date" type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="edit_reason">{t('reason_label')}</Label>
                <Textarea id="edit_reason" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} rows={3} required />
              </div>

             <div>
                <Label>{t('add_more_docs')}</Label>
                <div {...getEditRootProps()} className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${isEditDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}>
                  <input {...getEditInputProps()} />
                  <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">{t('click_or_drag_to_add_files')}</p>
                </div>
                {editFiles.length > 0 && (
                    <div className="mt-4 mb-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-gray-50 p-3">
                      {editFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-gray-100 mb-2">
                          <span className="truncate">{file.name}</span>
                          <button type="button" onClick={() => setEditFiles(prev => prev.filter((_, i) => i !== index))} className="text-red-600" title={t('remove_file')}><XCircleIcon className="h-5 w-5" /></button>
                        </div>
                      ))}
                    </div>
                )}
             </div>

             <div>
               <Label className="text-gray-600">{t('existing_documents')}</Label>
               <DocumentList documents={viewDocuments} onDownload={openFile} t={t} />
             </div>

             <div className="flex justify-end space-x-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditFiles([]); }}>{t('cancel')}</Button>
              <Button type="submit">{t('update_request')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('leave_request_details')}</DialogTitle></DialogHeader>
          {selectedLeave && (
            <div className="space-y-4">
              {canApproveLeaves && (
                <div>
                  <Label className="text-gray-600">{t('employee_label')}</Label>
                  <p className="font-medium">{selectedLeave.user?.first_name} {selectedLeave.user?.last_name}</p>
                </div>
              )}
              <div><Label className="text-gray-600">{t('leave_type')}</Label><p className="font-medium">{t(`leave_type_${selectedLeave.leave_type.replace(' ', '_').toLowerCase()}`)}</p></div>
              <div><Label className="text-gray-600">{t('reason_label')}</Label><p className="text-sm mt-1">{selectedLeave.reason}</p></div>
              
              <div><Label className="text-gray-600">{t('attached_documents')}</Label>
                <DocumentList documents={viewDocuments} onDownload={openFile} t={t} />
              </div>
              
              {selectedLeave.remarks && <div><Label className="text-gray-600">{t('remarks_label')}</Label><p className="text-sm mt-1">{selectedLeave.remarks}</p></div>}
            </div>
          )}
          <div className="flex justify-end pt-2"><Button onClick={() => setIsViewDialogOpen(false)}>{t('close')}</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('review_leave_request_title')}</DialogTitle>
            <DialogDescription>
              {selectedLeave && (
                <div className="mt-4 space-y-2 text-sm">
                  <p><strong>{t('employee_colon')}:</strong> {selectedLeave.user?.first_name} {selectedLeave.user?.last_name}</p>
                  <p><strong>{t('reason_colon')}:</strong> {selectedLeave.reason}</p>
                  
                  <div className="pt-2"><strong>{t('attached_documents_colon')}:</strong>
                    <DocumentList documents={viewDocuments} onDownload={openFile} t={t} />
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label htmlFor="remarks">{t('remarks_label')}</Label><Textarea id="remarks" value={reviewData.remarks} onChange={(e) => setReviewData({ ...reviewData, remarks: e.target.value })} rows={3} /></div>
            <div className="flex justify-end space-x-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setIsReviewDialogOpen(false); setReviewData({ remarks: '' }); }}>{t('cancel')}</Button>
              <Button type="button" variant="destructive" onClick={() => selectedLeave && handleRejectLeave(selectedLeave.id)}><X className="h-4 w-4 mr-2" />{t('reject')}</Button>
              <Button type="button" onClick={() => selectedLeave && handleApproveLeave(selectedLeave.id)} className="bg-green-600 hover:bg-green-700"><Check className="h-4 w-4 mr-2" />{t('approve')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaveManagement;