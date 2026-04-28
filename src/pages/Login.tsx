import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuthStore();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loginAs, setLoginAs] = useState<'organizer' | 'attendee'>('organizer');

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const res = await api.post<{ user: any }>('/api/auth/login', values);
      if (loginAs === 'organizer' && !['organizer', 'super_admin'].includes(res.user.role)) {
        setServerError('This account is attendee type. Switch to "Attendee" and try again.');
        return;
      }
      if (loginAs === 'attendee' && res.user.role !== 'attendee') {
        setServerError('This account is organizer type. Switch to "Organizer" and try again.');
        return;
      }
      setUser(res.user);
      const destination =
        res.user.role === 'super_admin'
          ? '/admin/dashboard'
          : res.user.role === 'attendee'
            ? '/attendee/dashboard'
            : from;
      navigate(destination, { replace: true });
    } catch (e: any) {
      setServerError(e?.message || e?.error || 'Login failed');
    }
  };

  return (
    <div className="mx-auto max-w-md py-10">
      <Card className="rounded-3xl p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Sign in</h1>
        <p className="mt-2 text-neutral-500">Choose account type, then continue.</p>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-1">
          <button
            type="button"
            onClick={() => setLoginAs('organizer')}
            className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
              loginAs === 'organizer' ? 'bg-[#00E676] text-[#062013] shadow-[0_8px_18px_rgba(0,230,118,0.25)]' : 'text-neutral-600 hover:bg-white'
            }`}
          >
            Event Organizer
          </button>
          <button
            type="button"
            onClick={() => setLoginAs('attendee')}
            className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
              loginAs === 'attendee' ? 'bg-[#00E676] text-[#062013] shadow-[0_8px_18px_rgba(0,230,118,0.25)]' : 'text-neutral-600 hover:bg-white'
            }`}
          >
            Attendee
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 flex flex-col gap-4">
          <Input label="Email" {...register('email')} type="email" placeholder="you@example.com" error={errors.email?.message} />
          <Input label="Password" {...register('password')} type="password" error={errors.password?.message} />

          {serverError && <p className="text-sm font-medium text-red-600">{serverError}</p>}
          <Button type="submit" disabled={isSubmitting} className="mt-2 h-11 w-full rounded-xl">
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-sm text-neutral-600">
          Don&apos;t have an account?{' '}
          <Link to={loginAs === 'attendee' ? '/attendee/signup' : '/signup'} className="font-semibold text-[#00a95d] hover:text-[#008e4f]">
            {loginAs === 'attendee' ? 'Create attendee account' : 'Create organizer account'}
          </Link>
        </p>
      </Card>
    </div>
  );
};

