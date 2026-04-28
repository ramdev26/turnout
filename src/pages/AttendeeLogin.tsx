import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '../api/client';
import { useAuthStore } from '../store/useAuthStore';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Field';
import { Button } from '../components/ui/Button';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

export const AttendeeLogin: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const res = await api.post<{ user: any }>('/api/auth/login', values);
      if (res.user.role !== 'attendee') {
        setServerError('This is organizer account. Use organizer login.');
        return;
      }
      setUser(res.user);
      navigate('/attendee/dashboard', { replace: true });
    } catch (e: any) {
      setServerError(e?.message || e?.error || 'Login failed');
    }
  };

  return (
    <div className="mx-auto max-w-md py-10">
      <Card className="rounded-3xl p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Attendee sign in</h1>
        <p className="mt-2 text-neutral-500">Access your ticket wallet and event reminders.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 flex flex-col gap-4">
          <Input label="Email" {...register('email')} type="email" error={errors.email?.message} />
          <Input label="Password" {...register('password')} type="password" error={errors.password?.message} />
          {serverError && <p className="text-sm font-medium text-red-600">{serverError}</p>}
          <Button type="submit" disabled={isSubmitting} className="mt-2 h-11 w-full rounded-xl">
            {isSubmitting ? 'Signing in...' : 'Sign in as attendee'}
          </Button>
        </form>

        <p className="mt-6 text-sm text-neutral-600">
          New attendee?{' '}
          <Link to="/attendee/signup" className="font-semibold text-[#00a95d] hover:text-[#008e4f]">
            Create account
          </Link>
        </p>
      </Card>
    </div>
  );
};
