import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { useTheme, ThemeMode, BackgroundTheme } from '@/contexts/ThemeContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, LogOut, Moon, Sun, Monitor, Shield, Mail, Globe, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';

const langLabels: Record<Language, string> = {
  uz: "O'zbek",
  ru: "Русский",
  en: "English",
};

const themeTranslations = {
  themeMode: { uz: "Rejim", ru: "Режим", en: "Mode" },
  light: { uz: "Yorug'", ru: "Светлая", en: "Light" },
  dark: { uz: "Qorong'u", ru: "Тёмная", en: "Dark" },
  system: { uz: "Tizim", ru: "Система", en: "System" },
  background: { uz: "Fon", ru: "Фон", en: "Background" },
  bgNone: { uz: "Oddiy", ru: "Обычный", en: "Default" },
  bgAurora: { uz: "Aurora", ru: "Аврора", en: "Aurora" },
  bgSunset: { uz: "Quyosh", ru: "Закат", en: "Sunset" },
  bgOcean: { uz: "Okean", ru: "Океан", en: "Ocean" },
} as const;

const themeModes: { key: ThemeMode; icon: typeof Sun }[] = [
  { key: 'light', icon: Sun },
  { key: 'dark', icon: Moon },
  { key: 'system', icon: Monitor },
];

const bgOptions: { key: BackgroundTheme; preview: string }[] = [
  { key: 'none', preview: 'bg-card' },
  { key: 'aurora', preview: 'bg-aurora' },
  { key: 'sunset', preview: 'bg-sunset' },
  { key: 'ocean', preview: 'bg-ocean' },
];

const bgLabelMap: Record<BackgroundTheme, keyof typeof themeTranslations> = {
  none: 'bgNone',
  aurora: 'bgAurora',
  sunset: 'bgSunset',
  ocean: 'bgOcean',
};

const Settings = () => {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const { mode, setMode, bgTheme, setBgTheme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();

  const tt = (key: keyof typeof themeTranslations) => themeTranslations[key][lang];

  const handleLogout = async () => {
    await logout();
    toast({ title: t('loggedOut'), description: t('loggedOutDesc') });
    navigate('/auth');
  };

  return (
    <AppLayout showNav={false}>
      <div className="p-4">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">{t('settings')}</h1>
        </div>

        <div className="space-y-4">
          {/* Language */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {t('language')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {(Object.keys(langLabels) as Language[]).map((l) => (
                  <Button
                    key={l}
                    variant={lang === l ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setLang(l)}
                  >
                    {langLabels[l]}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Appearance — Theme Mode */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4" />
                {t('appearance')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">{tt('themeMode')}</Label>
                <div className="flex gap-2">
                  {themeModes.map(({ key, icon: Icon }) => (
                    <Button
                      key={key}
                      variant={mode === key ? "default" : "outline"}
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={() => setMode(key)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tt(key)}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Background themes */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">{tt('background')}</Label>
                <div className="grid grid-cols-4 gap-2">
                  {bgOptions.map(({ key, preview }) => (
                    <button
                      key={key}
                      onClick={() => setBgTheme(key)}
                      className={cn(
                        "relative rounded-lg aspect-[3/4] overflow-hidden border-2 transition-all",
                        bgTheme === key
                          ? "border-primary ring-2 ring-primary/30 scale-105"
                          : "border-border/40 hover:border-border"
                      )}
                    >
                      <div className={cn("absolute inset-0", preview)} />
                      <span className="absolute bottom-0 inset-x-0 text-[10px] font-medium py-0.5 text-center bg-background/70 backdrop-blur-sm text-foreground">
                        {tt(bgLabelMap[key])}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {t('account')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('email')}</Label>
                <p className="text-sm font-medium">{user?.email}</p>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {t('security')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {t('securityDesc')}
              </p>
            </CardContent>
          </Card>

          {/* Logout */}
          <Button 
            variant="destructive" 
            className="w-full"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t('logout')}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default Settings;
