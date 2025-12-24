import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Download, FileText, Calendar, ListChecks, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Mock Payslip Data
const mockPayslips = [
  { id: 1, month: 'November 2025', amount: 4500.00, date: '2025-11-30' },
  { id: 2, month: 'October 2025', amount: 4500.00, date: '2025-10-31' },
  { id: 3, month: 'September 2025', amount: 4500.00, date: '2025-09-30' },
  { id: 4, month: 'August 2025', amount: 4500.00, date: '2025-08-31' },
  { id: 5, month: 'July 2025', amount: 4500.00, date: '2025-07-31' },
];

const MAX_ANNUAL_LEAVES = 40;

const EmployeeSelfService = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  // State for Real Data
  const [leaveStats, setLeaveStats] = useState({ 
    total: MAX_ANNUAL_LEAVES, 
    taken: 0, 
    remaining: MAX_ANNUAL_LEAVES, 
    exceeded: false 
  });
  const [taskHistory, setTaskHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // State for Mock Data
  const [payslips] = useState(mockPayslips);

  // Helper to calculate days between dates
  const calculateDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        // 1. Fetch Real Leaves
        const leavesRes = await axios.get('/leaves', { 
            params: { per_page: 100 }, 
            headers 
        });
        
        const myLeaves = leavesRes.data.leaves || [];
        const approvedLeaves = myLeaves.filter(l => l.status === 'Approved');
        
        let totalTaken = 0;
        approvedLeaves.forEach(leave => {
            totalTaken += calculateDays(leave.start_date, leave.end_date);
        });

        setLeaveStats({
            total: MAX_ANNUAL_LEAVES,
            taken: totalTaken,
            remaining: Math.max(0, MAX_ANNUAL_LEAVES - totalTaken),
            exceeded: totalTaken > MAX_ANNUAL_LEAVES
        });

        // 2. Fetch Real Tasks
        const tasksRes = await axios.get('/tasks', { headers });
        const myTasks = tasksRes.data.tasks || [];
        
        const history = myTasks
            .filter(task => task.assigned_to?.id === user?.id)
            .sort((a, b) => new Date(b.due_date) - new Date(a.due_date))
            .slice(0, 10); // Show more tasks since we have vertical space

        setTaskHistory(history);

      } catch (error) {
        console.error("Failed to fetch employee data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchData();
  }, [user]);

  // --- PDF GENERATORS ---

  const generatePayslipPDF = (payslip) => {
    try {
      const doc = new jsPDF();
      const userName = `${user?.first_name || 'Employee'} ${user?.last_name || ''}`;
      
      doc.setFillColor(59, 130, 246);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text("Payslip", 14, 25);
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.text(`Employee: ${userName}`, 14, 50);
      doc.text(`Month: ${payslip.month}`, 14, 58);
      doc.text(`Date Generated: ${new Date().toLocaleDateString()}`, 14, 66);

      autoTable(doc, {
        startY: 75,
        head: [['Description', 'Amount']],
        body: [
          ['Base Salary', payslip.amount.toFixed(2)],
          ['Allowances', (payslip.amount * 0.1).toFixed(2)],
          ['Deductions (Tax)', (payslip.amount * 0.15).toFixed(2)],
          [{ content: 'Net Pay', styles: { fontStyle: 'bold' } }, { content: `$${(payslip.amount * 0.95).toFixed(2)}`, styles: { fontStyle: 'bold' } }],
        ],
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
      });

      doc.save(`Payslip_${payslip.month.replace(' ', '_')}.pdf`);
    } catch (err) {
      console.error("PDF generation failed", err);
    }
  };

  const generateLeaveReportPDF = () => {
    try {
      const doc = new jsPDF();
      const userName = `${user?.first_name || 'Employee'} ${user?.last_name || ''}`;

      doc.setFontSize(18);
      doc.text("Leave Balance Report", 14, 22);
      doc.setFontSize(12);
      doc.text(`Employee: ${userName}`, 14, 30);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 36);

      const statusText = leaveStats.exceeded ? "Limit Exceeded" : "Within Limit";

      autoTable(doc, {
        startY: 45,
        head: [['Metric', 'Days']],
        body: [
          ['Annual Allowance', leaveStats.total],
          ['Days Taken', leaveStats.taken],
          ['Days Remaining', leaveStats.remaining],
          ['Status', statusText],
        ],
        theme: 'striped',
        headStyles: { fillColor: leaveStats.exceeded ? [220, 38, 38] : [59, 130, 246] },
      });

      if (leaveStats.exceeded) {
          doc.setTextColor(255, 0, 0);
          const finalY = doc.lastAutoTable?.finalY || 100;
          doc.text("You have exceeded your annual leave limit. Please meet with HR.", 14, finalY + 10);
      }

      doc.save(`Leave_Report_${userName.replace(' ', '_')}.pdf`);
    } catch (err) {
      console.error("PDF generation failed", err);
    }
  };

  const generateTaskReportPDF = () => {
    try {
      const doc = new jsPDF();
      const userName = `${user?.first_name || 'Employee'} ${user?.last_name || ''}`;

      doc.setFontSize(18);
      doc.text(t('task_history_report') || "Task History Report", 14, 22);
      doc.setFontSize(12);
      doc.text(`${t('employee_label')}: ${userName}`, 14, 30);
      doc.text(`${t('date')}: ${new Date().toLocaleDateString()}`, 14, 36);

      const tableBody = taskHistory.map(task => [
        task.title,
        task.status,
        task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'
      ]);

      autoTable(doc, {
        startY: 45,
        head: [[t('task_title'), t('status'), t('due_date')]],
        body: tableBody,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
      });

      doc.save(`Task_Report_${userName.replace(' ', '_')}.pdf`);
    } catch (err) {
      console.error("PDF generation failed", err);
    }
  };

  if (loading) return <div className="p-8 text-center">{t('loading')}...</div>;

  return (
    <div className="w-full space-y-6 pb-20 md:pb-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{t('employee_self_service')}</h1>
        <div className="text-sm text-gray-500 hidden sm:block bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>
      
      {/* Responsive Grid:
         - Mobile/Tablet (750px): 1 Column (cards stack vertically)
         - Desktop (lg): 3 Columns
      */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* --- LEAVE BALANCE CARD --- */}
        <Card className={`shadow-md hover:shadow-lg transition-shadow duration-300 ${leaveStats.exceeded ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">{t('leave_balance')}</CardTitle>
            <Calendar className={`h-5 w-5 ${leaveStats.exceeded ? 'text-red-500' : 'text-blue-500'}`} />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-bold ${leaveStats.exceeded ? 'text-red-600' : 'text-blue-600'}`}>
                    {leaveStats.remaining}
                </span>
                <span className="text-lg font-normal text-gray-500">{t('days_remaining')}</span>
            </div>
            
            <div className="mt-4 bg-white/60 p-3 rounded-lg border border-gray-100/50 space-y-2 text-sm">
                <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500">{t('annual_allowance')}:</span>
                    <span className="font-semibold text-gray-900">{leaveStats.total}</span>
                </div>
                <div className="flex justify-between pt-1">
                    <span className="text-gray-500">{t('days_taken')}:</span>
                    <span className={`font-semibold ${leaveStats.exceeded ? 'text-red-600' : 'text-gray-900'}`}>{leaveStats.taken}</span>
                </div>
            </div>

            {leaveStats.exceeded && (
                <Alert variant="destructive" className="mt-4 bg-white border-red-200 shadow-sm">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{t('leave_limit_exceeded')}</AlertTitle>
                    <AlertDescription className="text-xs mt-1">
                        {t('meet_hr_msg')}
                    </AlertDescription>
                </Alert>
            )}

            <Button 
              onClick={generateLeaveReportPDF} 
              variant={leaveStats.exceeded ? "destructive" : "outline"}
              size="sm" 
              className="mt-6 w-full h-10 shadow-sm"
            >
              <Download className="h-4 w-4 mr-2" /> {t('download_leave_report')}
            </Button>
          </CardContent>
        </Card>

        {/* --- PAYSLIP HISTORY CARD --- */}
        <Card className="lg:col-span-2 shadow-md hover:shadow-lg transition-shadow duration-300 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b bg-gray-50/50">
            <CardTitle className="text-sm font-medium text-gray-700">{t('payslip_history')}</CardTitle>
            <FileText className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {/* Taller ScrollArea for 1600px height devices */}
            <ScrollArea className="h-[300px] md:h-[350px] w-full">
              <div className="p-0">
                <Table>
                  <TableHeader className="bg-gray-50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="whitespace-nowrap w-[40%]">{t('month')}</TableHead>
                      <TableHead className="text-right whitespace-nowrap">{t('net_amount')}</TableHead>
                      <TableHead className="text-right whitespace-nowrap pr-6">{t('action')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payslips.map((payslip) => (
                      <TableRow key={payslip.id} className="hover:bg-gray-50/80 transition-colors">
                        <TableCell className="font-medium text-gray-900 py-3">
                            {/* Formatting fix for translation */}
                            {t(`month_${payslip.month.split(' ')[0].toLowerCase()}`)} {payslip.month.split(' ')[1]}
                        </TableCell>
                        <TableCell className="text-right font-mono text-gray-600">${payslip.amount.toFixed(2)}</TableCell>
                        <TableCell className="text-right pr-4">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 hover:text-blue-600 hover:bg-blue-50 transition-all"
                            onClick={() => generatePayslipPDF(payslip)}
                          >
                            <Download className="h-4 w-4 md:mr-2" /> 
                            <span className="hidden md:inline">{t('download')}</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Enable horizontal scroll for small tables */}
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* --- TASK HISTORY CARD --- */}
      <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-3 sm:space-y-0 pb-3 border-b bg-gray-50/50">
          <CardTitle className="text-sm font-medium text-gray-700">{t('recent_task_history')}</CardTitle>
          <div className="flex items-center gap-2 w-full sm:w-auto">
             <Button size="sm" variant="outline" onClick={generateTaskReportPDF} className="h-8 text-xs bg-white shadow-sm flex-1 sm:flex-none">
                <Download className="h-3 w-3 mr-1.5" /> {t('download_task_report')}
             </Button>
             <div className="bg-purple-100 p-1.5 rounded-md hidden sm:block">
                <ListChecks className="h-4 w-4 text-purple-600" />
             </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Increased height for tall screens */}
          <ScrollArea className="h-[300px] md:h-[400px] w-full">
            <div className="p-0">
              <Table>
                <TableHeader className="bg-gray-50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-[45%] whitespace-nowrap">{t('task_title')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('status')}</TableHead>
                    <TableHead className="text-right whitespace-nowrap pr-6">{t('due_date')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taskHistory.length === 0 ? (
                      <TableRow>
                          <TableCell colSpan={3} className="text-center text-gray-500 py-10">{t('no_tasks_found')}</TableCell>
                      </TableRow>
                  ) : (
                      taskHistory.map((task) => (
                      <TableRow key={task.id} className="hover:bg-gray-50/80 transition-colors">
                          <TableCell className="font-medium text-gray-900 py-3">
                              <div className="truncate max-w-[140px] md:max-w-none" title={task.title}>
                                {task.title}
                              </div>
                          </TableCell>
                          <TableCell>
                          <span className={`inline-flex px-2.5 py-0.5 text-[10px] md:text-xs font-medium rounded-full items-center gap-1.5 border ${
                              task.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200' : 
                              task.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              'bg-yellow-50 text-yellow-700 border-yellow-200'
                          }`}>
                              {task.status === 'Completed' && <CheckCircle2 className="h-3 w-3" />}
                              {task.status === 'Pending' && <Clock className="h-3 w-3" />}
                              {t(`status_${task.status.toLowerCase().replace(' ', '_')}`) || task.status}
                          </span>
                          </TableCell>
                          <TableCell className="text-right text-gray-500 text-xs md:text-sm pr-6">
                              {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                          </TableCell>
                      </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeSelfService;