import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  User, 
  Mail, 
  Key, 
  Save, 
  Eye, 
  EyeOff, 
  Shield, 
  Calendar, 
  Loader2 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext'; 

const ProfileSettings = () => {
  const { t } = useTranslation();
  const { user, updateProfile, changePassword } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    email: ''
  });

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || ''
      });
      setLoading(false);
    } else {
      setError(t('user_data_not_available'));
      setLoading(false);
    }
  }, [user]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await updateProfile(profileData);
      if (result.success) {
        setSuccess(t('success_profile_updated'));
      } else {
        setError(result.error || t('error_update_profile_failed'));
      }
    } catch (err) {
      setError(t('error_unexpected_error'));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (passwordData.new_password !== passwordData.confirm_password) {
      setError(t('error_passwords_do_not_match'));
      setLoading(false);
      return;
    }

    if (passwordData.new_password.length < 6) {
      setError(t('error_password_min_length'));
      setLoading(false);
      return;
    }

    try {
      const result = await changePassword(passwordData.current_password, passwordData.new_password);
      if (result.success) {
        setSuccess(t('success_password_changed'));
        setPasswordData({
          current_password: '',
          new_password: '',
          confirm_password: ''
        });
      } else {
        setError(result.error || t('error_change_password_failed'));
      }
    } catch (err) {
      setError(t('error_unexpected_error'));
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const tabs = [
    { id: 'profile', label: t('profile_tab_info'), icon: User },
    { id: 'password', label: t('profile_tab_password'), icon: Key },
    { id: 'account', label: t('profile_tab_account'), icon: Shield }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">{t('loading_profile')}</span>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="flex justify-center items-center h-full p-4">
        <Alert variant="destructive" className="max-w-md w-full">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full animate-in fade-in duration-500">
      <div className="px-1 md:px-0">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">{t('profile_settings_title')}</h2>
        <p className="text-sm md:text-base text-gray-600 mt-1">{t('profile_settings_desc')}</p>
      </div>

      {(error || success) && (
        <Alert variant={error ? 'destructive' : 'default'} className={success ? "border-green-200 bg-green-50 text-green-800" : ""}>
          <AlertDescription>{error || success}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Responsive Tabs List: Scrolls on very small screens, grid on larger */}
        <TabsList className="grid w-full grid-cols-3 h-auto p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id} 
                className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 py-2 sm:py-1.5 h-full whitespace-normal text-center sm:text-left"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="text-xs sm:text-sm font-medium">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="profile" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile_info_card_title')}</CardTitle>
              <CardDescription>{t('profile_info_card_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">{t('first_name')}</Label>
                    <Input
                      id="first_name"
                      value={profileData.first_name}
                      onChange={(e) => setProfileData({...profileData, first_name: e.target.value})}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">{t('last_name')}</Label>
                    <Input
                      id="last_name"
                      value={profileData.last_name}
                      onChange={(e) => setProfileData({...profileData, last_name: e.target.value})}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="email">{t('email')}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                      disabled={loading}
                    />
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full md:w-auto mt-2">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? t('saving') : t('save_changes')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="password" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('change_password_card_title')}</CardTitle>
              <CardDescription>{t('change_password_card_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current_password">{t('current_password')}</Label>
                  <div className="relative">
                    <Input
                      id="current_password"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordData.current_password}
                      onChange={(e) => setPasswordData({...passwordData, current_password: e.target.value})}
                      required
                      className="pr-10"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new_password">{t('new_password')}</Label>
                  <div className="relative">
                    <Input
                      id="new_password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordData.new_password}
                      onChange={(e) => setPasswordData({...passwordData, new_password: e.target.value})}
                      required
                      className="pr-10"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm_password">{t('confirm_new_password')}</Label>
                  <div className="relative">
                    <Input
                      id="confirm_password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={passwordData.confirm_password}
                      onChange={(e) => setPasswordData({...passwordData, confirm_password: e.target.value})}
                      required
                      className="pr-10"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full md:w-auto mt-2">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Key className="h-4 w-4 mr-2" />
                  {loading ? t('changing') : t('change_password')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('account_details_card_title')}</CardTitle>
              <CardDescription>{t('account_details_card_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4 text-gray-900">{t('basic_information')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Responsive Info Item */}
                    <div className="flex items-start space-x-3 bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                      <User className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-700">{t('username')}</p>
                        <p className="text-sm text-gray-600 truncate font-mono" title={user?.username}>
                          {user?.username || t('not_available')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                      <Mail className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-700">{t('email')}</p>
                        <p className="text-sm text-gray-600 truncate font-mono" title={user?.email}>
                          {user?.email || t('not_available')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                      <Calendar className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-700">{t('member_since')}</p>
                        <p className="text-sm text-gray-600">
                          {user?.created_at ? new Date(user.created_at).toLocaleDateString(t('locale')) : t('not_available')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                      <Shield className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-700 mb-1">{t('account_status')}</p>
                        <Badge variant={user?.is_active ? 'default' : 'secondary'} className={user?.is_active ? "bg-green-100 text-green-700 hover:bg-green-200 border-green-200" : ""}>
                          {user?.is_active ? t('status_active') : t('status_inactive')}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-4 text-gray-900">{t('roles_permissions')}</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-2 text-gray-700">{t('assigned_roles')}</p>
                      <div className="flex flex-wrap gap-2">
                        {user?.roles?.length ? (
                          user.roles.map((role) => (
                            <Badge key={role.id} variant="outline" className="px-3 py-1 bg-white">
                              {role.name}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500 italic">{t('no_roles_assigned')}</p> 
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2 text-gray-700">
                        {t('permissions_count', { count: user?.permissions?.length || 0 })}
                      </p>
                      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
                        {user?.permissions?.length ? (
                          user.permissions.map((permission, index) => (
                            <Badge key={index} variant="secondary" className="text-xs bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200">
                              {permission.replace(/_/g, ' ')}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500 italic">{t('no_permissions_assigned')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfileSettings;

