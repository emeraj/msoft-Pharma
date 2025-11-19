
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
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  const formInputStyle = "w-full p-2 bg-yellow-100 text-slate-900 placeholder-slate-500 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500";

  const clearRecaptcha = () => {
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (e) {
        console.debug("Recaptcha cleanup warning:", e);
      }
      window.recaptchaVerifier = null;
    }
  };

  const initRecaptcha = useCallback(async () => {
      // Ensure the ref is attached to a DOM node
      if (!recaptchaContainerRef.current) {
          console.debug("Recaptcha container not found yet.");
          return;
      }

      try {
          // Aggressively clear previous instances
          clearRecaptcha();
          
          // Pass the actual DOM element instead of ID string
          window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier(recaptchaContainerRef.current, {
              'size': 'invisible',
              'callback': () => {
                  // reCAPTCHA solved
                  setError('');
              },
              'expired-callback': () => {
                  setError('Security check expired. Please try again.');
                  setLoading(false);
                  // Auto-clear to allow re-render
                  clearRecaptcha();
              }
          });
          
          await window.recaptchaVerifier.render();
      } catch (error: any) {
          console.error("Recaptcha Init Error:", error);
          if (error.code === 'auth/internal-error') {
               setError(`Configuration Error: Domain "${window.location.hostname}" is not authorized. Go to Firebase Console -> Authentication -> Settings -> Authorized Domains and add this domain.`);
          } else {
               setError(`Security check failed: ${error.message}. Please refresh the page.`);
          }
      }
  }, []);

  // Initialize Recaptcha when switching to phone view
  useEffect(() => {
    let timer: number;
    if (authMethod === 'phone') {
        // Wait for React to paint the DOM and ref to be populated
        timer = window.setTimeout(initRecaptcha, 500);
    } else {
        clearRecaptcha();
    }
    return () => {
        clearTimeout(timer);
        clearRecaptcha();
    };
  }, [authMethod, initRecaptcha]);

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
      // JIT Initialization: If somehow verifier is missing (e.g. race condition), try to init now
      if (!window.recaptchaVerifier) {
          await initRecaptcha();
          // Give it a split second to render
          await new Promise(r => setTimeout(r, 100));
          
          if (!window.recaptchaVerifier) {
             throw new Error("Security check could not be initialized. Please refresh.");
          }
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
      } else if (error.code === 'auth/internal-error') {
          msg = `Domain "${window.location.hostname}" unauthorized. Check Firebase Console.`;
      } else if (error.message) {
          msg += " " + error.message;
      }
      
      setError(msg);
      // Reset to allow retry
      clearRecaptcha();
      setTimeout(initRecaptcha, 500); 
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

            {/* Always render container in DOM flow, attached to ref */}
            <div ref={recaptchaContainerRef} id="recaptcha-container" className="flex justify-center mb-4 min-h-[10px]"></div>

            {authMethod === 'email' ? (
                <form onSubmit={handleEmailAuth} className="space-y-4">
                    <h2 className="text-xl font-semibold text-center text-slate-800 dark:text-slate-200">
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
      </div>
    </div>
  );
};

export default Auth;
