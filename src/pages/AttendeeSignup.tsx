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
  displayName: z.string().min(2, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormValues = z.infer<typeof schema>;

export const AttendeeSignup: React.FC = () => {
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
      const res = await api.post<{ user: any }>('/api/auth/register-attendee', values);
      setUser(res.user);
      navigate('/attendee/dashboard', { replace: true });
    } catch (e: any) {
      setServerError(e?.message || e?.error || 'Signup failed');
    }
  };

  return (
    <div className="mx-auto max-w-md py-10">
      <Card className="rounded-3xl p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Create attendee account</h1>
        <p className="mt-2 text-neutral-500">Save your details and check in faster for every event.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 flex flex-col gap-4">
          <Input label="Display name" {...register('displayName')} placeholder="Your name" error={errors.displayName?.message} />
          <Input label="Email" {...register('email')} type="email" placeholder="you@example.com" error={errors.email?.message} />
          <Input label="Password" {...register('password')} type="password" error={errors.password?.message} />
          {serverError && <p className="text-sm font-medium text-red-600">{serverError}</p>}
          <Button type="submit" disabled={isSubmitting} className="mt-2 h-11 w-full rounded-xl">
            {isSubmitting ? 'Creating...' : 'Create attendee account'}
          </Button>
        </form>

        <p className="mt-6 text-sm text-neutral-600">
          Already have attendee access?{' '}
          <Link to="/attendee/login" className="font-semibold text-[#00a95d] hover:text-[#008e4f]">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
};
