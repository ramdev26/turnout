import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '../api/client';
import { AuthFlowLayout } from '../components/auth/AuthFlowLayout';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { FlowAlert, FlowButton, FlowInput, FlowLabel } from '../components/flow/FlowPrimitives';
import { APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { useEmailDeliverability } from '../hooks/useEmailDeliverability';

const schema = z.object({
  displayName: z.string().min(2, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormValues = z.infer<typeof schema>;

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const ui = APP_FLOW_UI;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const emailValue = watch('email') || '';
  const emailCheck = useEmailDeliverability(emailValue);

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const check = await emailCheck.recheck(values.email);
    if (check && !check.deliverable) {
      setServerError(check.message || 'This email does not look deliverable.');
      return;
    }
    try {
      const res = await api.post<{
        ok?: boolean;
        requiresEmailVerification?: boolean;
        email?: string;
        message?: string;
        error?: string;
      }>('/api/auth/register', values);

      if (res.requiresEmailVerification || res.ok) {
        const email = encodeURIComponent((res.email || values.email).trim().toLowerCase());
        navigate(`/verify-email?email=${email}`, { replace: true });
        return;
      }
      setServerError(res.message || res.error || 'Signup failed');
    } catch (e: unknown) {
      const err = e as { message?: string; error?: string; suggestedEmail?: string };
      if (err?.suggestedEmail) {
        setServerError(err.message || `Did you mean ${err.suggestedEmail}?`);
      } else {
        setServerError(err?.message || err?.error || 'Signup failed');
      }
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
          <FlowInput {...register('email')} type="email" autoComplete="email" placeholder="you@example.com" />
          {errors.email?.message && <span className="text-xs text-red-600">{errors.email.message}</span>}
          {emailCheck.checking && (
            <span className="text-xs" style={{ color: ui.textMuted }}>
              Checking email…
            </span>
          )}
          {!emailCheck.checking && emailCheck.message && (
            <span className="text-xs text-red-600">{emailCheck.message}</span>
          )}
          {!emailCheck.checking && emailCheck.suggestedEmail ? (
            <button
              type="button"
              className="self-start text-xs font-semibold underline-offset-2 hover:underline"
              style={{ color: ui.accent }}
              onClick={() => {
                setValue('email', emailCheck.suggestedEmail!, { shouldValidate: true, shouldDirty: true });
                setServerError(null);
              }}
            >
              Use {emailCheck.suggestedEmail}
            </button>
          ) : null}
        </label>
        <label className="flex flex-col gap-1.5">
          <FlowLabel>Password</FlowLabel>
          <FlowInput {...register('password')} type="password" autoComplete="new-password" />
          {errors.password?.message && <span className="text-xs text-red-600">{errors.password.message}</span>}
        </label>

        {serverError && <FlowAlert variant="error">{serverError}</FlowAlert>}
        <FlowButton
          type="submit"
          disabled={isSubmitting || emailCheck.checking || (!emailCheck.deliverable && !!emailValue)}
          className="mt-2 h-11 w-full"
        >
          {isSubmitting ? 'Creating...' : 'Create account'}
        </FlowButton>
      </form>

      <GoogleSignInButton
        role="organizer"
        label="Or sign up with Google"
        disabled={isSubmitting}
        onSuccess={() => {
          navigate('/dashboard', { replace: true });
        }}
      />

      <p className="mt-6 text-center text-sm sm:text-left" style={{ color: ui.textMuted }}>
        Already have an account?{' '}
        <Link to="/login" className="font-semibold" style={{ color: ui.accent }}>
          Sign in
        </Link>
      </p>
    </AuthFlowLayout>
  );
};
