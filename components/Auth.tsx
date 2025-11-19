
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { auth, firebase } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import Card from './common/Card';
import { CloudIcon, DeviceMobileIcon, UserCircleIcon } from './icons/Icons';

declare global {
  interface Window {
    recaptchaVerifier: any;
    confirmationResult: any;
  }
}

const Auth: React.FC = () => {
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  
  // Email State
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Phone State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // Common State
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Refs
  const recaptchaLoaded = useRef(false);

  const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";

  // Initialize Recaptcha - Single Instance Pattern (Preserved but inactive if phone is hidden)
  useEffect(() => {
    if (authMethod === 'phone' && !recaptchaLoaded.current) {
      const container = document.getElementById('recaptcha-container');
      if (container) {
        try {
            if (window.recaptchaVerifier) {
                try { window.recaptchaVerifier.clear(); } catch (e) {}
            }
            
            window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
                'size': 'invisible',
                'callback': () => {
                    // reCAPTCHA solved
                },
                'expired-callback': () => {
                    // Response expired
                }
            });
            
            window.recaptchaVerifier.render();
            recaptchaLoaded.current = true;
        } catch (e) {
            console.error("Recaptcha init error:", e);
        }
      }
    }
  }, [authMethod]);

  const handleEmailAuth = async (e: React.FormEvent) => {
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
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (phoneNumber.length < 10) {
        setError("Please enter a valid phone number (e.g., +919999999999)");
        setLoading(false);
        return;
    }

    let formattedNumber = phoneNumber;
    if (!formattedNumber.startsWith('+')) {
         formattedNumber = '+91' + formattedNumber; 
    }

    try {
      if (!window.recaptchaVerifier) {
          throw new Error("Security check not ready. Please refresh the page.");
      }

      const appVerifier = window.recaptchaVerifier;
      const confirmationResult = await auth.signInWithPhoneNumber(formattedNumber, appVerifier);
      window.confirmationResult = confirmationResult;
      setOtpSent(true);
    } catch (error: any) {
      console.error("SMS Error:", error);
      let msg = "Failed to send OTP.";
      if (error.code === 'auth/argument-error') {
           msg = "System Error: Security check failed. Please refresh the page.";
      } else if (error.code === 'auth/invalid-phone-number') {
          msg = "Invalid Phone Number format.";
      } else if (error.message) {
          msg += " " + error.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await window.confirmationResult.confirm(otp);
    } catch (error: any) {
      console.error("OTP Verify Error:", error);
      setError("Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAuthError = (err: any) => {
      const code = err.code;
      switch (code) {
        case 'auth/invalid-credential':
          setError('Incorrect credentials. Please try again.');
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
          setError(err.message || 'Failed to authenticate. Please try again.');
      }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-slate-100 dark:bg-slate-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mt-2 flex items-center justify-center gap-2">
                <CloudIcon className="h-8 w-8 text-indigo-500" />
                <span>Cloud - Retail</span>
            </h1>
            <p className="text-slate-600 dark:text-slate-400">Secure Login</p>
        </div>
        
        <Card>
            {/* Auth Method Toggle - HIDDEN as requested */}
            {/* 
            <div className="flex border-b dark:border-slate-700 mb-6">
                <button 
                    className={`flex-1 pb-2 text-sm font-medium text-center transition-colors duration-200 ${authMethod === 'email' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    onClick={() => { setAuthMethod('email'); setError(''); }}
                >
                    <UserCircleIcon className="h-5 w-5 inline-block mr-1" /> Email
                </button>
                <button 
                    className={`flex-1 pb-2 text-sm font-medium text-center transition-colors duration-200 ${authMethod === 'phone' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    onClick={() => { setAuthMethod('phone'); setError(''); }}
                >
                     <DeviceMobileIcon className="h-5 w-5 inline-block mr-1" /> Phone (OTP)
                </button>
            </div>
            */}

            {/* Container for reCAPTCHA - Hidden when authMethod is email */}
            <div id="recaptcha-container" className={`flex justify-center mb-4 min-h-[10px] ${authMethod === 'email' ? 'hidden' : ''}`}></div>

            {authMethod === 'email' ? (
                <form onSubmit={handleEmailAuth} className="space-y-4">
                    <h2 className="text-xl font-semibold text-center text-slate-800 dark:text-slate-200 mb-4">
                    {isLogin ? 'Email Login' : 'Create Account'}
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
                        placeholder="Your Name"
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
                        placeholder="name@example.com"
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
                        placeholder="••••••••"
                        />
                    </div>
                    
                    {error && <p className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</p>}
                    
                    <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 px-4 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 transition-colors"
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
            ) : (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-center text-slate-800 dark:text-slate-200">
                        {otpSent ? 'Enter Verification Code' : 'Phone Login'}
                    </h2>
                    
                    {!otpSent ? (
                        <form onSubmit={handleSendOtp} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                                <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={e => setPhoneNumber(e.target.value)}
                                    className={formInputStyle}
                                    placeholder="+91 9876543210"
                                    required
                                />
                                <p className="text-xs text-slate-500 mt-1">Format: +[CountryCode][Number] (e.g., +91...)</p>
                            </div>
                            
                            {error && <p className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</p>}
                            
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-2 px-4 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 transition-colors"
                            >
                                {loading ? 'Sending OTP...' : 'Send OTP'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">OTP Code</label>
                                <input
                                    type="text"
                                    value={otp}
                                    onChange={e => setOtp(e.target.value)}
                                    className={`${formInputStyle} text-center text-lg tracking-widest`}
                                    placeholder="123456"
                                    maxLength={6}
                                    required
                                />
                            </div>
                            
                            {error && <p className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</p>}
                            
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-2 px-4 bg-green-600 text-white font-semibold rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-400 transition-colors"
                            >
                                {loading ? 'Verifying...' : 'Verify & Login'}
                            </button>
                            
                            <button
                                type="button"
                                onClick={() => { setOtpSent(false); setOtp(''); setError(''); }}
                                className="w-full text-sm text-indigo-600 hover:text-indigo-500"
                            >
                                Change Phone Number
                            </button>
                        </form>
                    )}
                </div>
            )}
        </Card>

        <div className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400">
            <p>Developed by: M. Soft India | Contact: 9890072651 | Visit: <a href="https://webs.msoftindia.com" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">webs.msoftindia.com</a></p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
