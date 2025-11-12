import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, AuthError } from 'firebase/auth';
import Card from './common/Card';

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
      }
    } catch (err) {
      const authError = err as AuthError;
      switch (authError.code) {
        case 'auth/invalid-credential':
          setError('Incorrect email or password. Please try again.');
          break;
        case 'auth/email-already-in-use':
          setError('This email is already registered. Please login.');
          break;
        case 'auth/weak-password':
          setError('Password should be at least 6 characters.');
          break;
        case 'auth/invalid-email':
            setError('Please enter a valid email address.');
            break;
        default:
          setError('Failed to authenticate. Please try again.');
          console.error(authError);
      }
    } finally {
      setLoading(false);
    }
  };

  const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="flex-grow flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mt-2">
                Medico - Retail
            </h1>
            <p className="text-slate-600 dark:text-slate-400">Please sign in to continue</p>
        </div>
        <Card>
          <form onSubmit={handleAuthAction} className="space-y-4">
            <h2 className="text-2xl font-semibold text-center text-slate-800 dark:text-slate-200">
              {isLogin ? 'Login' : 'Sign Up'}
            </h2>
            
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={formInputStyle}
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={formInputStyle}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={formInputStyle}
                required
              />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
            >
              {loading ? 'Processing...' : (isLogin ? 'Login' : 'Create Account')}
            </button>
            <p className="text-sm text-center text-slate-600 dark:text-slate-400">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button
                type="button"
                onClick={() => { setIsLogin(!isLogin); setError(''); }}
                className="font-medium text-indigo-600 hover:text-indigo-500 ml-1"
              >
                {isLogin ? 'Sign Up' : 'Login'}
              </button>
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Auth;