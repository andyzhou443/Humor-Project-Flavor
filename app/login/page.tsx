import AuthButton from "@/components/AuthButton";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-4 text-2xl font-bold">Admin Portal</h1>
        <p className="mb-8 text-zinc-500">Sign in with your admin account to continue.</p>
        
        <div className="flex justify-center">
          {/* Use your existing AuthButton component */}
          <AuthButton user={null} />
        </div>
      </div>
    </div>
  );
}