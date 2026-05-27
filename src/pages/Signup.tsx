import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '../api/client';
import { useAuthStore } from '../store/useAuthStore';
import { AuthFlowLayout } from '../components/auth/AuthFlowLayout';
import { FlowAlert, FlowButton, FlowInput, FlowLabel } from '../components/flow/FlowPrimitives';
import { APP_FLOW_UI } from '../components/flow/FlowPrimitives';

const schema = z.object({
  displayName: z.string().min(2, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormValues = z.infer<typeof schema>;

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [serverError, setServerError] = useState<string | null>(null);
  const ui = APP_FLOW_UI;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const res = await api.post<{ user: Parameters<typeof setUser>[0] }>('/api/auth/register', values);
      setUser(res.user);
      navigate('/dashboard', { replace: true });
    } catch (e: unknown) {
      const err = e as { message?: string; error?: string };
      setServerError(err?.message || err?.error || 'Signup failed');
    }
  };

  return (
    <AuthFlowLayout title="Create organizer account" subtitle="Launch and manage events with one dashboard.">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <FlowLabel>Display name</FlowLabel>
          <FlowInput {...register('displayName')} placeholder="Your name" />
          {errors.displayName?.message && <span className="text-xs text-red-600">{errors.displayName.message}</span>}
        </label>
        <label className="flex flex-col gap-1.5">
          <FlowLabel>Email</FlowLabel>
          <FlowInput {...register('email')} type="email" placeholder="you@example.com" />
          {errors.email?.message && <span className="text-xs text-red-600">{errors.email.message}</span>}
        </label>
        <label className="flex flex-col gap-1.5">
          <FlowLabel>Password</FlowLabel>
          <FlowInput {...register('password')} type="password" />
          {errors.password?.message && <span className="text-xs text-red-600">{errors.password.message}</span>}
        </label>

        {serverError && <FlowAlert variant="error">{serverError}</FlowAlert>}
        <FlowButton type="submit" disabled={isSubmitting} className="mt-2 h-11 w-full">
          {isSubmitting ? 'Creating...' : 'Create account'}
        </FlowButton>
      </form>

      <p className="mt-6 text-center text-sm sm:text-left" style={{ color: ui.textMuted }}>
        Already have an account?{' '}
        <Link to="/login" className="font-semibold" style={{ color: ui.accent }}>
          Sign in
        </Link>
      </p>
    </AuthFlowLayout>
  );
};
