import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, ArrowLeft, Building2, Key } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address')
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

const ForgotPasswordPage = ({ onNavigate }) => {
  const [step, setStep] = useState('email'); // 'email' or 'reset'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetToken, setResetToken] = useState('');
  const { forgotPassword, resetPassword } = useAuth();

  const {
    register: registerEmail,
    handleSubmit: handleEmailSubmit,
    formState: { errors: emailErrors }
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema)
  });

  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    formState: { errors: resetErrors }
  } = useForm({
    resolver: zodResolver(resetPasswordSchema)
  });

  const onEmailSubmit = async (data) => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    const result = await forgotPassword(data.email);
    
    if (result.success) {
      setSuccess('Password reset instructions have been sent to your email.');
      // In demo mode, show the token
      if (result.data.reset_token) {
        setResetToken(result.data.reset_token);
        setStep('reset');
      }
    } else {
      setError(result.error);
    }
    
    setIsLoading(false);
  };

  const onResetSubmit = async (data) => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    const result = await resetPassword(data.token, data.newPassword);
    
    if (result.success) {
      setSuccess('Password has been reset successfully! You can now sign in with your new password.');
      setTimeout(() => {
        onNavigate('login');
      }, 2000);
    } else {
      setError(result.error);
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-purple-600 rounded-full">
              <Building2 className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">HR Management System</h1>
          <p className="text-gray-600 mt-2">
            {step === 'email' ? 'Reset your password' : 'Enter new password'}
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              {step === 'email' ? 'Forgot Password?' : 'Reset Password'}
            </CardTitle>
            <CardDescription className="text-center">
              {step === 'email' 
                ? 'Enter your email address and we\'ll send you a reset link'
                : 'Enter the reset token and your new password'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'email' ? (
              <form onSubmit={handleEmailSubmit(onEmailSubmit)} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert className="border-green-200 bg-green-50">
                    <AlertDescription className="text-green-800">{success}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email address"
                    {...registerEmail('email')}
                    className={emailErrors.email ? 'border-red-500' : ''}
                  />
                  {emailErrors.email && (
                    <p className="text-sm text-red-500">{emailErrors.email.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sending...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 mr-2" />
                      Send Reset Link
                    </div>
                  )}
                </Button>

                {resetToken && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800 mb-2">
                      <strong>Demo Mode:</strong> Your reset token is:
                    </p>
                    <code className="text-sm bg-yellow-100 px-2 py-1 rounded">{resetToken}</code>
                    <Button
                      onClick={() => setStep('reset')}
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                    >
                      Continue to Reset Password
                    </Button>
                  </div>
                )}
              </form>
            ) : (
              <form onSubmit={handleResetSubmit(onResetSubmit)} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert className="border-green-200 bg-green-50">
                    <AlertDescription className="text-green-800">{success}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="token">Reset Token</Label>
                  <Input
                    id="token"
                    type="text"
                    placeholder="Enter the reset token"
                    defaultValue={resetToken}
                    {...registerReset('token')}
                    className={resetErrors.token ? 'border-red-500' : ''}
                  />
                  {resetErrors.token && (
                    <p className="text-sm text-red-500">{resetErrors.token.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Enter your new password"
                    {...registerReset('newPassword')}
                    className={resetErrors.newPassword ? 'border-red-500' : ''}
                  />
                  {resetErrors.newPassword && (
                    <p className="text-sm text-red-500">{resetErrors.newPassword.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your new password"
                    {...registerReset('confirmPassword')}
                    className={resetErrors.confirmPassword ? 'border-red-500' : ''}
                  />
                  {resetErrors.confirmPassword && (
                    <p className="text-sm text-red-500">{resetErrors.confirmPassword.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Resetting...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Key className="h-4 w-4 mr-2" />
                      Reset Password
                    </div>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('email')}
                  className="w-full"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Email
                </Button>
              </form>
            )}

            <div className="mt-6 text-center">
              <button
                onClick={() => onNavigate('login')}
                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Sign In
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
