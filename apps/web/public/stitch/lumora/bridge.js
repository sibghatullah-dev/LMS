(function () {
  const API_BASE = '/api/v1';
  const TOKEN_KEY = 'lumora_access_token';
  const USER_KEY = 'lumora_user';
  const DEFAULT_INSTITUTION = 'lumora';

  const ROUTES = {
    login: '/login',
    register: '/register',
    studentDashboard: '/dashboard',
    instructorDashboard: '/instructor/dashboard',
    adminDashboard: '/admin/dashboard',
    catalog: '/catalog',
    studentCourse: '/learn/demo-course',
    instructorCourse: '/instructor/courses/demo-course',
    instructorCourses: '/instructor/courses',
    adminCourses: '/admin/courses',
    users: '/admin/users',
    messages: '/messages',
    events: '/events',
    notifications: '/notifications',
    profile: '/profile',
    myCourses: '/my-courses',
    badges: '/badges',
    certificates: '/certificates',
    live: '/live/session/demo-session',
  };

  function pageKind() {
    const path = window.location.pathname;
    const title = document.title.toLowerCase();
    if (path.includes('admin') || title.includes('admin') || title.includes('user management')) return 'admin';
    if (path.includes('instructor') || title.includes('instructor') || title.includes('editor')) return 'instructor';
    return 'student';
  }

  function textOf(node) {
    return (node && node.textContent ? node.textContent : '').replace(/\s+/g, ' ').trim();
  }

  function iconOf(node) {
    const icon = node && node.querySelector && node.querySelector('.material-symbols-outlined');
    return icon ? textOf(icon) : '';
  }

  function field(id) {
    return document.getElementById(id);
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
    button.disabled = busy;
    button.innerHTML = busy
      ? '<span class="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>' + (label ? ' ' + label : '')
      : button.dataset.originalHtml;
  }

  function toast(message, tone) {
    let host = document.getElementById('lumora-bridge-toast');
    if (!host) {
      host = document.createElement('div');
      host.id = 'lumora-bridge-toast';
      host.style.position = 'fixed';
      host.style.right = '24px';
      host.style.bottom = '24px';
      host.style.zIndex = '99999';
      host.style.display = 'grid';
      host.style.gap = '10px';
      host.style.pointerEvents = 'none';
      document.body.appendChild(host);
    }

    const item = document.createElement('div');
    item.textContent = message;
    item.style.maxWidth = '360px';
    item.style.padding = '12px 14px';
    item.style.borderRadius = '8px';
    item.style.boxShadow = '0 12px 36px rgba(15, 23, 42, 0.18)';
    item.style.border = '1px solid rgba(255, 255, 255, 0.28)';
    item.style.font = '600 13px Inter, system-ui, sans-serif';
    item.style.color = '#fff';
    item.style.background = tone === 'error' ? '#b3261e' : tone === 'success' ? '#0f766e' : '#3048b5';
    item.style.pointerEvents = 'auto';
    host.appendChild(item);
    setTimeout(() => item.remove(), 3400);
  }

  function modal(title, fields, onSubmit) {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '99998';
    overlay.style.display = 'grid';
    overlay.style.placeItems = 'center';
    overlay.style.padding = '24px';
    overlay.style.background = 'rgba(15, 23, 42, 0.42)';

    const panel = document.createElement('form');
    panel.style.width = 'min(460px, 100%)';
    panel.style.borderRadius = '12px';
    panel.style.background = '#fff';
    panel.style.boxShadow = '0 24px 80px rgba(15, 23, 42, 0.24)';
    panel.style.padding = '22px';
    panel.style.font = '14px Inter, system-ui, sans-serif';

    const heading = document.createElement('h2');
    heading.textContent = title;
    heading.style.margin = '0 0 16px';
    heading.style.fontSize = '20px';
    heading.style.fontWeight = '700';
    panel.appendChild(heading);

    fields.forEach((item) => {
      const label = document.createElement('label');
      label.textContent = item.label;
      label.style.display = 'grid';
      label.style.gap = '6px';
      label.style.marginBottom = '12px';
      label.style.fontWeight = '600';
      const input = item.type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
      input.name = item.name;
      input.value = item.value || '';
      input.placeholder = item.placeholder || '';
      if (item.type && item.type !== 'textarea') input.type = item.type;
      input.required = item.required !== false;
      input.style.width = '100%';
      input.style.border = '1px solid #cbd5e1';
      input.style.borderRadius = '8px';
      input.style.padding = '10px 12px';
      input.style.font = '14px Inter, system-ui, sans-serif';
      if (item.type === 'textarea') input.style.minHeight = '92px';
      label.appendChild(input);
      panel.appendChild(label);
    });

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.justifyContent = 'flex-end';
    actions.style.gap = '10px';
    actions.style.marginTop = '18px';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.style.padding = '9px 13px';
    cancel.style.border = '1px solid #cbd5e1';
    cancel.style.borderRadius = '8px';
    cancel.style.background = '#fff';
    cancel.addEventListener('click', () => overlay.remove());

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = 'Save';
    submit.style.padding = '9px 14px';
    submit.style.border = '0';
    submit.style.borderRadius = '8px';
    submit.style.background = '#0f172a';
    submit.style.color = '#fff';
    submit.style.fontWeight = '700';

    actions.append(cancel, submit);
    panel.appendChild(actions);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) overlay.remove();
    });
    panel.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(panel).entries());
      overlay.remove();
      onSubmit(data);
    });
    const first = panel.querySelector('input, textarea');
    if (first) first.focus();
  }

  function destinationForRole(role) {
    if (role === 'admin' || role === 'super_admin') return ROUTES.adminDashboard;
    if (role === 'instructor') return ROUTES.instructorDashboard;
    return ROUTES.studentDashboard;
  }

  function go(path) {
    if (!path) return;
    if (window.top && window.top !== window) {
      window.top.location.href = path;
      return;
    }
    window.location.href = path;
  }

  async function request(path, options) {
    const body = options && options.body;
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = 'Bearer ' + token;

    const response = await fetch(API_BASE + path, {
      method: (options && options.method) || 'GET',
      credentials: 'include',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : null;
    if (!response.ok) {
      throw new Error((data && data.error && data.error.message) || 'Request failed.');
    }
    return data;
  }

  function rememberSession(data) {
    if (data && data.accessToken) localStorage.setItem(TOKEN_KEY, data.accessToken);
    if (data && data.user) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }

  async function logout() {
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch (_error) {
      // Local cleanup still matters if the refresh cookie has already expired.
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      go(ROUTES.login);
    }
  }

  function wireAuthForms() {
    const institution = field('institution');
    const slug = field('slug');
    if (institution && !institution.value) institution.value = DEFAULT_INSTITUTION;
    if (slug && !slug.value) slug.value = DEFAULT_INSTITUTION;

    const loginForm = field('loginForm');
    if (loginForm) {
      loginForm.addEventListener(
        'submit',
        async function (event) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const button = loginForm.querySelector('button[type="submit"]');
          setBusy(button, true, 'Signing in...');
          try {
            const data = await request('/auth/login', {
              method: 'POST',
              body: {
                email: field('email') && field('email').value,
                password: field('password') && field('password').value,
                institutionSlug: (field('institution') && field('institution').value) || DEFAULT_INSTITUTION,
              },
            });
            rememberSession(data);
            toast('Signed in successfully.', 'success');
            go(destinationForRole(data.user && data.user.role));
          } catch (error) {
            setBusy(button, false);
            toast(error.message || 'Sign in failed.', 'error');
          }
        },
        true,
      );
    }

    const registrationForm = field('registrationForm');
    if (registrationForm) {
      registrationForm.addEventListener(
        'submit',
        async function (event) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const button = registrationForm.querySelector('button[type="submit"]');
          const roleInput = registrationForm.querySelector('input[name="role"]:checked');
          setBusy(button, true, 'Creating account...');
          try {
            await request('/auth/register', {
              method: 'POST',
              body: {
                fullName: field('full_name') && field('full_name').value,
                email: field('email') && field('email').value,
                password: field('password') && field('password').value,
                institutionSlug: (field('slug') && field('slug').value) || DEFAULT_INSTITUTION,
                role: roleInput ? roleInput.value : 'student',
              },
            });
            toast('Account created. You can sign in now.', 'success');
            setTimeout(() => go(ROUTES.login), 650);
          } catch (error) {
            setBusy(button, false);
            toast(error.message || 'Registration failed.', 'error');
          }
        },
        true,
      );
    }
  }

  function routeFromLabel(label, icon) {
    const role = pageKind();
    const value = normalize(label + ' ' + icon);
    if (value.includes('sign out') || value.includes('logout')) return 'logout';
    if (value.includes('register')) return ROUTES.register;
    if (value.includes('sign in') || value === 'login') return ROUTES.login;
    if (value.includes('user management') || value.includes('person_search') || value === 'users') return ROUTES.users;
    if (value.includes('dashboard')) return role === 'admin' ? ROUTES.adminDashboard : role === 'instructor' ? ROUTES.instructorDashboard : ROUTES.studentDashboard;
    if (value.includes('courses') || value.includes('school')) {
      if (role === 'admin') return ROUTES.adminCourses;
      if (role === 'instructor') return ROUTES.instructorCourses;
      return ROUTES.catalog;
    }
    if (value.includes('catalog') || value.includes('browse') || value.includes('explore')) return ROUTES.catalog;
    if (value.includes('calendar') || value.includes('events') || value.includes('calendar_today') || value.includes('event')) return ROUTES.events;
    if (value.includes('messages') || value.includes('messaging') || value.includes('inbox') || value.includes('chat')) return ROUTES.messages;
    if (value.includes('notifications') || value.includes('bell')) return ROUTES.notifications;
    if (value.includes('profile') || value.includes('settings') || value.includes('account_circle')) return ROUTES.profile;
    if (value.includes('resources') || value.includes('folder_open')) return role === 'instructor' ? '/instructor/templates' : ROUTES.myCourses;
    if (value.includes('reports') || value.includes('analytics')) return role === 'admin' ? ROUTES.adminDashboard : role === 'instructor' ? ROUTES.instructorDashboard : '/leaderboard/demo-course';
    if (value.includes('review')) return role === 'admin' ? ROUTES.adminCourses : ROUTES.studentCourse;
    if (value.includes('continue') || value.includes('resume') || value.includes('view all') || value.includes('assignments')) return ROUTES.studentCourse;
    if (value.includes('enroll now') || value.includes('enroll in a new course')) return ROUTES.catalog;
    if (value.includes('live') || value.includes('classroom') || value.includes('join') || value.includes('video_call')) return ROUTES.live;
    if (value.includes('certificate')) return ROUTES.certificates;
    if (value.includes('badge')) return ROUTES.badges;
    return null;
  }

  function makeRow(values) {
    const tr = document.createElement('tr');
    tr.className = 'bg-white';
    values.forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      td.className = 'px-lg py-md font-body-sm text-body-sm text-on-surface';
      tr.appendChild(td);
    });
    return tr;
  }

  function openCreateModal(label) {
    const value = normalize(label);
    if (value.includes('message') || value.includes('add_comment')) {
      modal('New message', [
        { label: 'Recipient', name: 'recipient', placeholder: 'Student or instructor' },
        { label: 'Message', name: 'message', type: 'textarea', placeholder: 'Write your message' },
      ], (data) => {
        appendMessage(data.message || 'Message sent.');
        toast('Message sent.', 'success');
      });
      return true;
    }
    if (value.includes('user') || value.includes('invite') || value.includes('person_add')) {
      modal('Invite user', [
        { label: 'Full name', name: 'name', placeholder: 'New user' },
        { label: 'Email', name: 'email', type: 'email', placeholder: 'name@institution.edu' },
        { label: 'Role', name: 'role', placeholder: 'student' },
      ], (data) => {
        const tbody = document.querySelector('tbody');
        if (tbody) tbody.prepend(makeRow([data.name || 'New user', data.email || 'pending@lumora.local', data.role || 'student', 'Invited']));
        toast('Invitation created.', 'success');
      });
      return true;
    }
    if (value.includes('event') || value.includes('calendar')) {
      modal('Create event', [
        { label: 'Title', name: 'title', placeholder: 'Live workshop' },
        { label: 'Date', name: 'date', type: 'date' },
      ], (data) => toast((data.title || 'Event') + ' scheduled.', 'success'));
      return true;
    }
    if (value.includes('course') || value.includes('add')) {
      modal('Create course', [
        { label: 'Course title', name: 'title', placeholder: 'New course' },
        { label: 'Description', name: 'description', type: 'textarea', required: false },
      ], (data) => {
        toast((data.title || 'Course') + ' draft created.', 'success');
        if (pageKind() === 'instructor') setTimeout(() => go(ROUTES.instructorCourse), 500);
      });
      return true;
    }
    return false;
  }

  function appendMessage(message) {
    const text = String(message || '').trim();
    if (!text) return;
    const composer = document.querySelector('textarea[placeholder*="message"], textarea[placeholder*="Message"]');
    if (composer) composer.value = '';
    const bubble = document.createElement('div');
    bubble.className = 'ml-auto my-2 max-w-[78%] rounded-lg bg-primary text-on-primary px-md py-sm font-body-sm text-body-sm';
    bubble.textContent = text;
    const target = composer ? composer.closest('main, .flex, section') : document.querySelector('main');
    if (target) target.insertBefore(bubble, composer ? composer.closest('div') : null);
  }

  function handleCommand(label, icon, source) {
    const value = normalize(label + ' ' + icon);
    const route = routeFromLabel(label, icon);
    const isButton = source && source.tagName === 'BUTTON';
    const isLocalControl =
      isButton &&
      /^(all subjects|computer science|business|engineering|humanities|data science|design|medicine|assignments|exams|all users|students|instructors|admins|courses|messages|system|content|live sessions|resources|settings|analytics|chat|polls|list view|calendar|video|whiteboard|daily|weekly|1|2|3|42|125)$/i.test(
        textOf(source),
      );

    if (route === 'logout') {
      logout();
      return true;
    }
    if (route === ROUTES.login || route === ROUTES.register) {
      go(route);
      return true;
    }
    if (isLocalControl) return false;
    if (value.includes('send')) {
      const composer = document.querySelector('textarea[placeholder*="message"], textarea[placeholder*="Message"]');
      appendMessage(composer && composer.value ? composer.value : 'Message sent.');
      toast('Message sent.', 'success');
      return true;
    }
    if (value.includes('done_all') || value.includes('mark read')) {
      document.querySelectorAll('.group, article, li').forEach((item) => {
        if (textOf(item).toLowerCase().includes('notification') || item.querySelector('.material-symbols-outlined')) item.style.opacity = '0.56';
      });
      toast('Notifications marked as read.', 'success');
      return true;
    }
    if (value.includes('filter_list')) {
      modal('Filter results', [
        { label: 'Keyword', name: 'keyword', required: false },
        { label: 'Status', name: 'status', required: false },
      ], (data) => {
        applyTextFilter(data.keyword || data.status || '');
        toast('Filter applied.', 'success');
      });
      return true;
    }
    if (value.includes('add') || value.includes('new') || value.includes('invite') || value.includes('person_add') || value.includes('add_comment')) {
      if (openCreateModal(label + ' ' + icon)) return true;
    }
    if (value.includes('favorite')) {
      source.classList.toggle('text-error');
      toast(source.classList.contains('text-error') ? 'Saved to favorites.' : 'Removed from favorites.', 'success');
      return true;
    }
    if (value.includes('close')) {
      const panel = source.closest('section, aside, .fixed, .rounded-xl, .rounded-lg');
      if (panel) panel.style.display = 'none';
      return true;
    }
    if (value.includes('download') || value.includes('export')) {
      downloadText('lumora-export.csv', 'name,status\nLumora export,ready\n');
      toast('Export downloaded.', 'success');
      return true;
    }
    if (value.includes('register now') || value === 'register' || value.includes('set reminder')) {
      source.textContent = value.includes('reminder') ? 'REMINDER SET' : 'REGISTERED';
      source.disabled = true;
      toast(value.includes('reminder') ? 'Reminder set.' : 'Registration confirmed.', 'success');
      return true;
    }
    if (value.includes('publish') || value.includes('save') || value.includes('submit') || value.includes('approve') || value.includes('reject') || value.includes('archive') || value.includes('edit') || value.includes('upload') || value.includes('duplicate') || value.includes('content_copy')) {
      toast((label || 'Action') + ' completed.', 'success');
      return true;
    }
    if (route) {
      go(route);
      return true;
    }
    return false;
  }

  function downloadText(filename, body) {
    const blob = new Blob([body], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function wireNavigation() {
    document.addEventListener(
      'click',
      function (event) {
        const anchor = event.target.closest && event.target.closest('a');
        if (anchor) {
          const href = anchor.getAttribute('href');
          if (!href || href === '#' || href.startsWith('#')) {
            event.preventDefault();
            event.stopImmediatePropagation();
            const label = textOf(anchor);
            const icon = iconOf(anchor);
            if (!handleCommand(label, icon, anchor)) toast('This section is ready.', 'info');
          }
          return;
        }

        const button = event.target.closest && event.target.closest('button');
        if (!button || button.type === 'submit' || button.id === 'togglePassword') return;
        const label = textOf(button);
        const icon = button.dataset.icon || iconOf(button);
        if (handleCommand(label, icon, button)) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      true,
    );
  }

  function applyTextFilter(query) {
    const text = normalize(query);
    const items = document.querySelectorAll('main article, main tbody tr, main li, main [class*="group/card"], main [class*="border-outline"]');
    items.forEach((item) => {
      const match = !text || normalize(textOf(item)).includes(text);
      item.style.display = match ? '' : 'none';
    });
  }

  function wireFilters() {
    document.querySelectorAll('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]').forEach((input) => {
      input.addEventListener('input', function () {
        applyTextFilter(input.value);
      });
    });

    document.querySelectorAll('button').forEach((button) => {
      const label = textOf(button);
      if (!/all subjects|computer science|business|engineering|humanities|data science|design|medicine|assignments|exams|all users|students|instructors|admins|courses|messages|system/i.test(label)) return;
      button.addEventListener('click', function () {
        const group = button.parentElement;
        if (group) {
          group.querySelectorAll('button').forEach((item) => {
            item.classList.remove('bg-primary', 'text-on-primary', 'bg-white', 'text-on-surface');
            item.classList.add('text-secondary');
          });
        }
        button.classList.add('bg-primary', 'text-on-primary');
        button.classList.remove('text-secondary');
        if (!/^all/i.test(label)) applyTextFilter(label);
        else applyTextFilter('');
        toast(label + ' filter applied.', 'success');
      });
    });
  }

  function wireTabs() {
    document.querySelectorAll('button').forEach((button) => {
      const label = textOf(button);
      if (!/content|assignments|live sessions|resources|settings|students|analytics|chat|polls|list view|calendar|video|whiteboard/i.test(label)) return;
      button.addEventListener('click', function () {
        const group = button.parentElement;
        if (group) {
          group.querySelectorAll('button').forEach((item) => {
            item.classList.remove('active-tab', 'border-primary', 'text-primary', 'bg-white');
            item.classList.add('text-secondary');
          });
        }
        button.classList.add('active-tab', 'border-primary', 'text-primary');
        button.classList.remove('text-secondary');
        toast(label + ' view selected.', 'success');
      });
    });
  }

  function wireEditableControls() {
    document.querySelectorAll('input, textarea').forEach((input) => {
      input.addEventListener('change', () => {
        if (!input.closest('form')) toast('Changes saved locally.', 'success');
      });
    });
    document.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.addEventListener('change', () => toast(input.checked ? 'Selected.' : 'Deselected.', 'success'));
    });
  }

  function hydrateUserName() {
    try {
      const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
      if (!user || !user.fullName) return;
      document.querySelectorAll('h1, h2, p, span, div').forEach((node) => {
        if (node.childElementCount) return;
        if (/Alex Johnson|Dr\. Sarah Chen|Admin User|Platform Admin/.test(node.textContent || '')) {
          node.textContent = node.textContent.replace(/Alex Johnson|Dr\. Sarah Chen|Admin User|Platform Admin/g, user.fullName);
        }
      });
    } catch (_error) {
      // Ignore malformed local storage from older builds.
    }
  }

  function init() {
    wireAuthForms();
    wireNavigation();
    wireFilters();
    wireTabs();
    wireEditableControls();
    hydrateUserName();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
