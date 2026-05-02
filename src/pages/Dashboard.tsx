import { useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { Onboarding } from './Onboarding';
import { LeaderDashboard } from './LeaderDashboard';
import { MemberDashboard } from './MemberDashboard';
import { AdminDashboard } from './AdminDashboard';
import { ReportGenerator } from './ReportGenerator';
import { FamiCall } from './FamiCall';

export function Dashboard() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only redirect if we are SURE there is no role and loading is finished
    if (!loading && !profile?.role) {
      if (!window.location.pathname.includes('/onboarding')) {
        navigate('/dashboard/onboarding');
      }
    }
  }, [profile?.role, loading, navigate]);

  if (loading) return null;

  return (
    <Routes>
      <Route path="onboarding" element={<Onboarding />} />
      <Route path="leader" element={<LeaderDashboard />} />
      <Route path="leader/report/:activityId" element={<ReportGenerator />} />
      <Route path="member/*" element={<MemberDashboard />} />
      <Route path="admin" element={<AdminDashboard />} />
      <Route path="call" element={<FamiCall />} />
      <Route 
        path="*" 
        element={
          profile?.role === 'admin' ? (
            <Navigate to="admin" replace />
          ) : profile?.role === 'leader' ? (
            <Navigate to="leader" replace />
          ) : profile?.role === 'member' ? (
            <Navigate to="member" replace />
          ) : (
            <Navigate to="onboarding" replace />
          )
        } 
      />
    </Routes>
  );
}
