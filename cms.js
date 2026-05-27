document.addEventListener('DOMContentLoaded', () => {
    let isEditMode = false;
    let cmsPassword = sessionStorage.getItem('cms_password') || '';

    // Listen for Ctrl+Shift+E
    document.addEventListener('keydown', async (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'E') {
            e.preventDefault();
            if (!isEditMode) {
                if (!cmsPassword) {
                    const pwd = prompt('Zadajte heslo pre úpravu obsahu (Admin):');
                    if (!pwd) return;
                    
                    try {
                        const res = await fetch('/api/verify', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ password: pwd })
                        });
                        if (res.ok) {
                            cmsPassword = pwd;
                            sessionStorage.setItem('cms_password', cmsPassword);
                            enableEditMode();
                        } else {
                            alert('Nesprávne heslo!');
                        }
                    } catch(err) {
                        alert('Chyba pri overovaní hesla.');
                    }
                } else {
                    try {
                        const res = await fetch('/api/verify', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ password: cmsPassword })
                        });
                        if (res.ok) {
                            enableEditMode();
                        } else {
                            sessionStorage.removeItem('cms_password');
                            cmsPassword = '';
                            alert('Platnosť hesla vypršala alebo bolo zmenené. Skúste to znova.');
                        }
                    } catch(err) {
                        alert('Chyba pri overovaní hesla.');
                    }
                }
            } else {
                disableEditMode();
            }
        }
    });

    // Prevent navigation on editable links during edit mode
    document.addEventListener('click', (e) => {
        if (isEditMode) {
            const link = e.target.closest('a');
            if (link) {
                e.preventDefault();
            }
        }
    });

    function enableEditMode() {
        isEditMode = true;
        
        // Add toolbar
        const toolbar = document.createElement('div');
        toolbar.id = 'cms-toolbar';
        toolbar.innerHTML = `
            <div class="cms-toolbar-inner">
                <span>Režim úprav aktívny</span>
                <button id="cms-save-btn">Uložiť zmeny</button>
                <button id="cms-cancel-btn">Zrušiť</button>
            </div>
        `;
        document.body.appendChild(toolbar);

        document.getElementById('cms-save-btn').addEventListener('click', saveChanges);
        document.getElementById('cms-cancel-btn').addEventListener('click', () => {
            if(confirm('Naozaj chcete zrušiť zmeny?')) {
                location.reload();
            }
        });

        // Make elements editable
        document.querySelectorAll('[data-cms-id]').forEach(el => {
            el.setAttribute('contenteditable', 'true');
            el.classList.add('cms-editable');
        });
    }

    function disableEditMode() {
        isEditMode = false;
        const toolbar = document.getElementById('cms-toolbar');
        if (toolbar) toolbar.remove();
        
        document.querySelectorAll('[data-cms-id]').forEach(el => {
            el.removeAttribute('contenteditable');
            el.classList.remove('cms-editable');
        });
    }

    async function saveChanges() {
        const btn = document.getElementById('cms-save-btn');
        btn.textContent = 'Ukladá sa...';
        btn.disabled = true;

        try {
            // 1. Fetch the original, clean HTML of the current page from the server
            const res = await fetch(window.location.href);
            const originalHtmlString = await res.text();
            
            // 2. Parse it into a DOM document
            const parser = new DOMParser();
            const originalDoc = parser.parseFromString(originalHtmlString, 'text/html');

            // 3. Map edited content to the clean document
            const liveElements = document.querySelectorAll('[data-cms-id]');
            liveElements.forEach(liveEl => {
                const id = liveEl.getAttribute('data-cms-id');
                const targetEl = originalDoc.querySelector(`[data-cms-id="${id}"]`);
                if (targetEl) {
                    targetEl.innerHTML = liveEl.innerHTML;
                }
            });

            // 4. Serialize back to HTML string
            const newHtmlString = '<!DOCTYPE html>\n' + originalDoc.documentElement.outerHTML;

            // 5. Determine the current path (e.g. index.html)
            let path = window.location.pathname;
            if (path === '/' || path === '') path = '/index.html';

            // 6. Send to the Cloudflare function
            const saveRes = await fetch('/api/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    password: cmsPassword,
                    path: path,
                    content: newHtmlString
                })
            });

            const responseData = await saveRes.json();

            if (saveRes.ok) {
                btn.textContent = 'Uložené!';
                btn.style.backgroundColor = '#4caf50';
                setTimeout(() => {
                    alert('Zmeny boli úspešne uložené a odoslané na GitHub. O pár minút sa stránka aktualizuje pre všetkých.');
                    disableEditMode();
                }, 500);
            } else {
                console.error(responseData);
                alert('Chyba pri ukladaní: ' + (responseData.error || 'Neznáma chyba'));
                if (responseData.error && responseData.error.includes('password')) {
                    sessionStorage.removeItem('cms_password');
                    cmsPassword = '';
                }
                btn.textContent = 'Skúsiť znova';
                btn.disabled = false;
            }

        } catch (error) {
            console.error(error);
            alert('Nastala chyba. Skontrolujte konzolu.');
            btn.textContent = 'Skúsiť znova';
            btn.disabled = false;
        }
    }
});
