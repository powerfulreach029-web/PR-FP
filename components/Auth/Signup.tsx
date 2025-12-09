import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Loader2, Mail, Lock, UserPlus, Sparkles } from 'lucide-react';

interface SignupProps {
  onSwitchToLogin: () => void;
}

const Signup: React.FC<SignupProps> = ({ onSwitchToLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      
      alert("Compte créé ! Veuillez vous connecter.");
      onSwitchToLogin();

    } catch (err: any) {
      setError(err.message || "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 bg-white/10 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
             <div className="bg-gradient-to-tr from-purple-500 to-pink-500 p-3 rounded-full shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
             </div>
        </div>
        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Rejoignez-nous</h2>
        <p className="text-indigo-200 text-sm">Créez votre espace pédagogique intelligent</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 text-red-100 rounded-xl text-sm backdrop-blur-sm flex items-center justify-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSignup} className="space-y-5">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-indigo-100 ml-1 uppercase tracking-wider">Email</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-indigo-300 group-focus-within:text-white transition-colors" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full pl-11 pr-4 py-4 bg-slate-900/40 border border-indigo-400/30 rounded-xl text-white placeholder-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-slate-900/60 transition-all duration-300"
              placeholder="votre@email.com"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-indigo-100 ml-1 uppercase tracking-wider">Mot de passe</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-indigo-300 group-focus-within:text-white transition-colors" />
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full pl-11 pr-4 py-4 bg-slate-900/40 border border-indigo-400/30 rounded-xl text-white placeholder-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-slate-900/60 transition-all duration-300"
              placeholder="Minimum 6 caractères"
              required
              minLength={6}
            />
          </div>
          <p className="text-xs text-indigo-300/70 text-right">6 caractères minimum</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white font-bold rounded-xl shadow-lg shadow-purple-500/30 transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <UserPlus className="w-5 h-5" />
              S'inscrire gratuitement
            </>
          )}
        </button>
      </form>

      <div className="mt-8 text-center">
        <p className="text-indigo-200 text-sm">
          Déjà un compte ?{' '}
          <button 
            onClick={onSwitchToLogin}
            className="text-white font-bold hover:underline decoration-purple-400 underline-offset-4 transition-all"
          >
            Se connecter
          </button>
        </p>
      </div>
    </div>
  );
};

export default Signup;