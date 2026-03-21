import { SignInForm } from '@/components/auth/signin-form';

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gradient mb-2">ShowcaseIt</h1>
          <p className="text-gray-400">Sign in to create beautiful user manuals</p>
        </div>
        <SignInForm />
      </div>
    </div>
  );
}
