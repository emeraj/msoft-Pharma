
import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import Card from './common/Card';
import { CloudIcon } from './icons/Icons';

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
    } catch (err: any) {
      const code = err.code;
      switch (code) {
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
          console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex flex-col font-sans transition-colors duration-200">
      <div className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
              <h1 className="text-4xl font-extrabold text-slate-800 dark:text-slate-200 mt-2 flex items-center justify-center gap-3">
                  <CloudIcon className="h-10 w-10 text-indigo-600" />
                  <span className="tracking-tight">Cloud-TAG</span>
              </h1>
              <p className="mt-3 text-lg font-serif italic font-medium text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
                “Tag Your Business to the Cloud”
              </p>
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
                className="w-full py-2 px-4 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 transition-all transform active:scale-95"
              >
                {loading ? 'Processing...' : (isLogin ? 'Login' : 'Create Account')}
              </button>
              <p className="text-sm text-center text-slate-600 dark:text-slate-400">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button
                  type="button"
                  onClick={() => { setIsLogin(!isLogin); setError(''); }}
                  className="font-medium text-indigo-600 hover:text-indigo-500 ml-1 hover:underline"
                >
                  {isLogin ? 'Sign Up' : 'Login'}
                </button>
              </p>
            </form>
          </Card>
        </div>
      </div>
      <footer className="bg-white dark:bg-slate-800 border-t dark:border-slate-700 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-600 dark:text-slate-400">
          <p>Developed by: M. Soft India | Contact: 9890072651 | Visit: https://msoftindia.com</p>
        </div>
      </footer>
    </div>
  );
};

export default Auth;
