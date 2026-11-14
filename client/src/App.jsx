import React from 'react';
import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, WandSparkles, LayoutDashboard, CreditCard, LogOut, Code2, Monitor, ShieldCheck, History, ArrowUpRight, LoaderCircle, Copy, Download } from 'lucide-react';
import { request } from './api';

const money = (amount, currency) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(amount / 100);
function toHexColor(color) {
  const match = color.match(/\d+/g);

  if (!match || match.length < 3) return '#000000';

  return '#' + match.slice(0, 3)
    .map(value => Number(value).toString(16).padStart(2, '0'))
    .join('');
}
function makeEditableHtml(html) {
  const editorScript = `
    <script>
      (() => {
        let nextId = 1;
        let selected = null;

        document.addEventListener('click', (event) => {
          const element = event.target.closest(
            'h1,h2,h3,h4,h5,h6,p,span,a,button,li,label'
          );

          if (!element) return;

          event.preventDefault();
          event.stopPropagation();

          if (!element.dataset.sfId) {
            element.dataset.sfId = String(nextId++);
          }

          if (selected) selected.style.outline = '';

          selected = element;
          selected.style.outline = '2px solid #7c3aed';
          selected.style.outlineOffset = '3px';

          parent.postMessage({
            type: 'SITEFORGE_SELECT',
            id: element.dataset.sfId,
            text: element.innerText,
            color: getComputedStyle(element).color
          }, '*');
        }, true);
        window.addEventListener('message', (event) => {
  if (event.data?.type === 'SITEFORGE_EXPORT') {
    parent.postMessage({
      type: 'SITEFORGE_EXPORT_RESULT',
      html: '<!DOCTYPE html>' + document.documentElement.outerHTML
    }, '*');
  }
});
        window.addEventListener('message', (event) => {
          const data = event.data;

          if (data?.type !== 'SITEFORGE_UPDATE') return;

          const element = document.querySelector(
            '[data-sf-id="' + CSS.escape(data.id) + '"]'
          );

          if (!element) return;

          element.innerText = data.text;
          if (data.color) {
  element.style.setProperty('color', data.color, 'important');
}parent.postMessage({
  type: 'SITEFORGE_EXPORT_RESULT',
  html: '<!DOCTYPE html>' + document.documentElement.outerHTML
}, '*');
        });
      })();
    </script>
  `;

  return html.includes('</body>')
    ? html.replace('</body>', editorScript + '</body>')
    : html + editorScript;
}

export default function App() {
  const [selectedElement, setSelectedElement] = useState(null);
  const [editedText, setEditedText] = useState('');
  const [textColor, setTextColor] = useState('#000000');
  const previewRef = useRef(null);
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('builder');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [editedHtml, setEditedHtml] = useState('');
  const [website, setWebsite] = useState(null);
  const [websites, setWebsites] = useState([]);
  const [packages, setPackages] = useState([]);
  const [currency, setCurrency] = useState('inr');
  const [authMode, setAuthMode] = useState('login');
  const [auth, setAuth] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adminUsers, setAdminUsers] = useState([]);
  const [grant, setGrant] = useState({ email: '', credits: 10 });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  useEffect(() => {
  function handleEditorMessage(event) {
    if (event.source !== previewRef.current?.contentWindow) return;
    if (event.data?.type === 'SITEFORGE_EXPORT_RESULT') {
  setEditedHtml(event.data.html);
  return;
}
    if (event.data?.type === 'SITEFORGE_SELECT') {
      setSelectedElement(event.data.id);
      setEditedText(event.data.text);
      setTextColor(toHexColor(event.data.color || 'rgb(0, 0, 0)'));
    }
  }

  window.addEventListener('message', handleEditorMessage);

  return () => {
    window.removeEventListener('message', handleEditorMessage);
  };
}, []);

function updatePreview(text, color = textColor) {
  previewRef.current?.contentWindow?.postMessage({
    type: 'SITEFORGE_UPDATE',
    id: selectedElement,
    text,
    color
  }, '*');
}
  async function refreshMe() {
    const data = await request('/auth/me');
    setUser(data.user);
  }
  useEffect(() => {
    if (localStorage.getItem('token')) refreshMe().catch(() => { localStorage.removeItem('token'); setUser(null); });
  }, []);
  useEffect(() => {
    if (user) {
      request('/websites').then(d => setWebsites(d.websites)).catch(() => {});
      request('/payments/packages').then(d => { setPackages(d.packages); setCurrency(d.currency); }).catch(() => {});
      if (user.role === 'ADMIN') request('/admin/users').then(d => setAdminUsers(d.users)).catch(() => {});
    }
  }, [user]);
  useEffect(() => {
    if (searchParams.get('payment') === 'success') setNotice('Payment received. Your credits will appear after Stripe confirms the payment.');
    if (searchParams.get('payment') === 'cancelled') setNotice('Payment cancelled. No credits were charged.');
  }, [searchParams]);

  async function submitAuth(e) {
    e.preventDefault(); setError('');
    try {
      const data = await request(`/auth/${authMode}`, { method: 'POST', body: JSON.stringify(auth) });
      localStorage.setItem('token', data.token); setUser(data.user); setNotice('Welcome to SiteForge AI.');
    } catch (e) { setError(e.message); }
  }
  function logout() { localStorage.removeItem('token'); setUser(null); setWebsite(null); setPage('builder'); }
  async function generate(e) {
    e.preventDefault(); setError(''); setNotice('');
    if (prompt.trim().length < 12) return setError('Please describe your website in at least 12 characters.');
    setBusy(true);
    try {
      const data = await request('/websites/generate', { method: 'POST', body: JSON.stringify({ prompt }) });
      setWebsite(data.website); setUser(u => ({ ...u, credits: data.website.creditsRemaining }));
      setWebsites(old => [{ id: data.website.id, title: data.website.title, prompt: data.website.prompt, createdAt: data.website.createdAt }, ...old]);
      setNotice('Website generated successfully. One credit used.');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function openWebsite(id) {
    try { const data = await request(`/websites/${id}`); setWebsite(data.website); setPage('builder'); }
    catch (e) { setError(e.message); }
  }
  async function buy(packageId) {
    setError('');
    try {
      const data = await request('/payments/checkout', { method: 'POST', body: JSON.stringify({ packageId }) });
      window.location.href = data.url;
    } catch (e) { setError(e.message); }
  }
  async function grantCredits(e) {
    e.preventDefault(); setError('');
    try {
      await request('/admin/grant-credits', { method: 'POST', body: JSON.stringify({ email: grant.email, credits: Number(grant.credits) }) });
      await refreshMe();
      const data = await request('/admin/users'); setAdminUsers(data.users);
      setNotice(`Added ${grant.credits} credits to ${grant.email}.`);
      setGrant({ email: '', credits: 10 });
    } catch (e) { setError(e.message); }
  }
  function downloadHtml() {
  if (!website) return;

  const html = editedHtml || website.html;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'my-ai-website.html';
  a.click();

  URL.revokeObjectURL(url);
}
  async function copyCode() {
    if (!website) return;
    const html = editedHtml || website.html;
    await navigator.clipboard.writeText(html);
    setNotice('HTML copied to clipboard.');
  }

  if (!user) return <main className="auth-shell">
    <div className="auth-card">
      <div className="brand-mark"><Sparkles size={22}/></div>
      <p className="eyebrow">YOUR AI DESIGN STUDIO</p>
      <h1>Build a website.<br/><span>Just describe it.</span></h1>
      <p className="muted">Turn your idea into a responsive website in seconds.</p>
      <form onSubmit={submitAuth} className="stack">
        {authMode === 'register' && <label>Your name<input required minLength="2" value={auth.name} onChange={e => setAuth({...auth, name:e.target.value})} placeholder="Alex Morgan"/></label>}
        <label>Email address<input required type="email" value={auth.email} onChange={e => setAuth({...auth, email:e.target.value})} placeholder="you@example.com"/></label>
        <label>Password<input required minLength="8" type="password" value={auth.password} onChange={e => setAuth({...auth, password:e.target.value})} placeholder="At least 8 characters"/></label>
        {error && <p className="error">{error}</p>}
        <button className="primary full">{authMode === 'login' ? 'Sign in' : 'Create account'} <ArrowUpRight size={17}/></button>
      </form>
      <p className="switch-auth">{authMode === 'login' ? "New here?" : 'Already have an account?'} <button onClick={() => {setAuthMode(authMode === 'login' ? 'register' : 'login');setError('');}}>{authMode === 'login' ? 'Create account' : 'Sign in'}</button></p>
      <p className="tiny">New accounts receive 5 free credits.</p>
    </div>
  </main>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Sparkles size={19}/></div><span>siteforge<span className="brand-ai">.ai</span></span></div>
      <div className="side-label">WORKSPACE</div>
      <button className={`nav-item ${page==='builder'?'active':''}`} onClick={()=>setPage('builder')}><WandSparkles size={18}/> Website Builder</button>
      <button className={`nav-item ${page==='history'?'active':''}`} onClick={()=>setPage('history')}><History size={18}/> My websites</button>
      <button className={`nav-item ${page==='credits'?'active':''}`} onClick={()=>setPage('credits')}><CreditCard size={18}/> Credits & billing</button>
      {user.role === 'ADMIN' && <><div className="side-label admin-label">ADMIN</div><button className={`nav-item ${page==='admin'?'active':''}`} onClick={()=>setPage('admin')}><ShieldCheck size={18}/> Admin panel</button></>}
      <div className="sidebar-bottom">
        <div className="credit-box"><span className="credit-icon"><Sparkles size={15}/></span><div><b>{user.credits} credits</b><small>Available balance</small></div><button onClick={()=>setPage('credits')} aria-label="Buy credits">+</button></div>
        <div className="profile"><div className="avatar">{user.name?.[0]?.toUpperCase()}</div><div className="profile-info"><b>{user.name}</b><small>{user.email}</small></div><button className="icon-btn" onClick={logout} title="Sign out"><LogOut size={17}/></button></div>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div><span className="breadcrumb">Workspace</span><span className="slash">/</span><b>{page === 'builder' ? 'Website Builder' : page === 'history' ? 'My websites' : page === 'credits' ? 'Credits & billing' : 'Admin panel'}</b></div><div className="top-right"><span className="status-dot"/> All systems operational</div></header>
      <div className="content">
        {error && <div className="alert error-box">{error}<button onClick={()=>setError('')}>×</button></div>}
        {notice && <div className="alert success-box">{notice}<button onClick={()=>setNotice('')}>×</button></div>}

        {page === 'builder' && <section>
          <div className="page-heading"><p className="eyebrow"><Sparkles size={14}/> AI WEBSITE GENERATOR</p><h1>What are we <span>building today?</span></h1><p className="muted">Describe your vision. Let AI turn it into a real website.</p></div>
          <div className="builder-grid">
            <div className="prompt-panel panel">
              <div className="panel-title"><div className="title-icon"><WandSparkles size={18}/></div><div><b>Describe your website</b><small>Be as detailed as you like</small></div></div>
              <form onSubmit={generate}>
                <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={3000} placeholder={"Example: Create a premium coffee shop website called 'Morning Ritual'. Use a warm beige and espresso color palette, a bold hero headline, menu cards, our story section, customer reviews and a contact footer. Make it mobile responsive..."} />
                <div className="prompt-footer"><span>{prompt.length}/3000 characters</span><span><Sparkles size={13}/> {user.credits} credits available</span></div>
                <button className="primary generate-btn" disabled={busy || user.credits < 1}>{busy ? <><LoaderCircle className="spin" size={18}/> Creating your website...</> : <><Sparkles size={18}/> Generate website <span>· 1 credit</span></>}</button>
              </form>
              <div className="tips"><b>✦ Pro tip</b><p>Include your business type, colors, sections and style. Specific prompts create better results.</p></div>
            </div>
            <div className="right-column">
              <div className="panel ideas"><div className="panel-title"><div className="title-icon"><Code2 size={18}/></div><div><b>Need inspiration?</b><small>Try one of these prompts</small></div></div>
                {[
                  ['☕','Coffee shop','A modern coffee shop landing page with warm colors, menu cards and location details.'],
                  ['💼','Agency portfolio','A sleek creative agency portfolio with services, projects and a contact CTA.'],
                  ['🧘','Wellness studio','A calming yoga studio website with class schedules, instructor profiles and pricing.']
                ].map(([icon,title,desc])=><button className="idea" key={title} onClick={()=>setPrompt(`Create a beautiful, responsive ${desc} Use polished typography, strong visual hierarchy and mobile-friendly design.`)}><span>{icon}</span><div><b>{title}</b><small>{desc}</small></div><ArrowUpRight size={15}/></button>)}
              </div>
              <div className="mini-stats"><div className="panel stat"><Monitor size={18}/><b>Responsive</b><small>Mobile-ready layouts</small></div><div className="panel stat"><Code2 size={18}/><b>Real HTML</b><small>Download your code</small></div></div>
            </div>
          </div>
          {website && <div className="preview-panel panel"><div className="preview-head"><div><b>Website preview</b><small>{website.title}</small></div><div className="preview-actions"><button className="secondary" onClick={copyCode}><Copy size={15}/> Copy HTML</button><button className="primary small-btn" onClick={downloadHtml}><Download size={15}/> Download</button></div></div><iframe
  ref={previewRef}
  title="Generated website preview"
  sandbox="allow-scripts"
  srcDoc={makeEditableHtml(website.html)}
  style={{ width: '100%', minHeight: '650px', border: 'none' }}
/>

<div style={{
  padding: '20px',
  marginTop: '15px',
  background: '#f8f7fc',
  borderRadius: '12px'
}}>
  <h3>Edit your website</h3>

  {selectedElement ? (
    <>
      <label style={{ display: 'block', marginBottom: '12px' }}>
        Text content
        <textarea
          value={editedText}
          onChange={e => {
            setEditedText(e.target.value);
            updatePreview(e.target.value);
          }}
          style={{
            display: 'block',
            width: '100%',
            minHeight: '90px',
            marginTop: '8px',
            padding: '10px'
          }}
        />
      </label>

      <label>
        Text color
        <input
          type="color"
          value={textColor}
          onChange={e => {
            setTextColor(e.target.value);
            updatePreview(editedText, e.target.value);
          }}
        />
      </label>
    </>
  ) : (
    <p>Click a heading, paragraph or button in your preview to edit it.</p>
  )}
</div>
     </div>}
        </section>}

        {page === 'history' && <section><div className="page-heading"><p className="eyebrow">YOUR PROJECTS</p><h1>My <span>websites</span></h1><p className="muted">Every website you've generated, all in one place.</p></div><div className="history-list">{websites.length===0?<div className="empty panel">No websites yet. Generate your first one!</div>:websites.map(w=><button className="history-row panel" key={w.id} onClick={()=>openWebsite(w.id)}><div className="title-icon"><Code2 size={19}/></div><div><b>{w.title}</b><small>{new Date(w.createdAt).toLocaleString()}</small></div><ArrowUpRight size={17}/></button>)}</div></section>}

        {page === 'credits' && <section><div className="page-heading"><p className="eyebrow">SIMPLE, TRANSPARENT PRICING</p><h1>Power up your <span>creativity.</span></h1><p className="muted">One credit = one successful website generation.</p></div><div className="balance-card panel"><div><small>YOUR CURRENT BALANCE</small><h2>{user.credits} <span>credits</span></h2></div><Sparkles size={34}/></div><div className="pricing-grid">{packages.map((p,i)=><div className={`price-card panel ${i===1?'featured':''}`} key={p.id}>{i===1&&<div className="popular">MOST POPULAR</div>}<p className="eyebrow">{['STARTER','CREATOR','STUDIO'][i]}</p><h2>{p.credits} <small>credits</small></h2><p className="muted">Generate {p.credits} custom websites</p><div className="price">{money(p.amount,currency)}</div><button className={i===1?'primary full':'secondary full'} onClick={()=>buy(p.id)}>Buy credits <ArrowUpRight size={16}/></button></div>)}</div><p className="tiny center">Secure checkout powered by Stripe. Credits are added after payment confirmation.</p></section>}

        {page === 'admin' && user.role === 'ADMIN' && <section><div className="page-heading"><p className="eyebrow">ADMINISTRATION</p><h1>Admin <span>control center.</span></h1><p className="muted">Manage users and grant promotional credits.</p></div><div className="panel admin-grant"><h3>Grant credits</h3><form className="grant-form" onSubmit={grantCredits}><input type="email" required placeholder="User email" value={grant.email} onChange={e=>setGrant({...grant,email:e.target.value})}/><input type="number" min="1" max="10000" required value={grant.credits} onChange={e=>setGrant({...grant,credits:e.target.value})}/><button className="primary">Grant credits</button></form></div><div className="panel users-panel"><h3>Users <span>{adminUsers.length}</span></h3><div className="user-table"><div className="table-head"><span>USER</span><span>ROLE</span><span>CREDITS</span></div>{adminUsers.map(u=><div className="table-row" key={u.id}><div><b>{u.name}</b><small>{u.email}</small></div><span>{u.role}</span><b>{u.credits}</b></div>)}</div></div></section>}
      </div>
    </main>
  </div>;
}
