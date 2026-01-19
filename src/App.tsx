import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PushNotification } from "@/components/notifications/PushNotification";
import { useEffect } from "react";

import Home from "./pages/Home";
import AuthLogin from "./pages/AuthLogin";
import Signup from "./pages/Signup";
import VerifyOtp from "./pages/VerifyOtp";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import Settings from "./pages/Settings";
import Relatives from "./pages/Relatives";
import CreatePost from "./pages/CreatePost";
import CreateStory from "./pages/CreateStory";
import Notifications from "./pages/Notifications";
import UserProfile from "./pages/UserProfile";
import Messages from "./pages/Messages";
import Chat from "./pages/Chat";
import GroupChat from "./pages/GroupChat";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const ThemeInitializer = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }, []);
  
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeInitializer>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <PushNotification />
            <Routes>
              <Route path="/auth" element={<PublicRoute><AuthLogin /></PublicRoute>} />
              <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
              <Route path="/verify-otp" element={<PublicRoute><VerifyOtp /></PublicRoute>} />
              <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/relatives" element={<ProtectedRoute><Relatives /></ProtectedRoute>} />
              <Route path="/create-post" element={<ProtectedRoute><CreatePost /></ProtectedRoute>} />
              <Route path="/create-story" element={<ProtectedRoute><CreateStory /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/user/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
              <Route path="/chat/:userId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
              <Route path="/group-chat/:groupId" element={<ProtectedRoute><GroupChat /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeInitializer>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
