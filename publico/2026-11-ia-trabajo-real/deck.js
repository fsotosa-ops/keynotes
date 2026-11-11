// Motor del deck: escala el escenario, avanza por pasos (→ / espacio / clic), anima lo que entra
// y abre una vista del presentador (tecla P) con notas, tiempo y próxima lámina.
// URL: #12 salta a la lámina 12 · ?paso=3 revela 3 pasos · ?grabar oculta el cursor y la barra.
(() => {
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]
  const stage = $('#stage')
  const lams = $$('.lam')
  const canal = new BroadcastChannel('deck-crear-software')
  const params = new URLSearchParams(location.search)
  let idx = 0, paso = 0
  const t0 = Date.now()

  // Escala 1920×1080 a la ventana
  const ajustar = () => {
    const k = Math.min(innerWidth / 1920, innerHeight / 1080)
    stage.style.transform = `scale(${k}) translate(-50%, -50%)`
    stage.style.left = '50%'; stage.style.top = '50%'
    stage.style.transformOrigin = '0 0'
    stage.style.transform = `translate(-50%, -50%) scale(${k})`
    stage.style.transformOrigin = 'center'
  }
  addEventListener('resize', ajustar); ajustar()

  // Marca en cada lámina
  lams.forEach(l => {
    if (!l.querySelector('.marca')) {
      // Marcas: UCV Virtual (en una píldora clara, el logo es a color) y Sumadots
      const m = document.createElement('div'); m.className = 'marca'
      m.innerHTML = '<span class="ucv"><img src="media/ucv-virtual.png" alt="UCV Virtual · Facultad de Ingeniería y Arquitectura"></span><img class="sd" src="media/sumadots-wordmark-white.svg" alt="Sumadots">'
      l.appendChild(m)
    }
    $$('.a', l).forEach((e, i) => { if (!e.style.getPropertyValue('--i')) e.style.setProperty('--i', i) })
  })

  // Puntos: 100 personas; .queda = las que siguen, .queda2 = las de después
  $$('.puntos').forEach(el => {
    const total = +el.dataset.total || 100, q1 = +el.dataset.quedan || 0, q2 = +el.dataset.quedan2 || 0
    const elegir = (n, seed) => { const s = new Set(); let x = seed; while (s.size < n) { x = (x * 1103515245 + 12345) % 2147483648; s.add(x % total) } return s }
    const a = elegir(q1, 12345), b = new Set([...a, ...elegir(Math.max(0, q2 - q1), 777)])
    el.innerHTML = Array.from({ length: total }, (_, i) =>
      `<i class="${a.has(i) ? 'queda' : ''} ${b.has(i) ? 'queda2' : ''}" style="transition-delay:${(i % 20) * 14 + Math.floor(i / 20) * 50}ms"></i>`).join('')
  })

  // Contadores: data-cuenta, data-pre, data-suf, data-dec
  const contar = el => {
    const fin = parseFloat(el.dataset.cuenta), dec = +el.dataset.dec || 0
    const pre = el.dataset.pre || '', suf = el.dataset.suf || ''
    const ini = parseFloat(el.dataset.desde || 0), dur = +el.dataset.dur || 1500, t0 = performance.now()
    const fmt = v => v.toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec })
    const paso = t => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3)
      el.textContent = pre + fmt(ini + (fin - ini) * e) + suf
      if (p < 1) requestAnimationFrame(paso)
    }
    el.textContent = pre + fmt(ini) + suf
    setTimeout(() => requestAnimationFrame(paso), +el.dataset.retraso || 350)
  }

  // Ganchos por lámina: window.Ganchos[id] = { entrar(l), paso(n, l), salir(l) }
  const G = window.Ganchos || {}

  const pasos = l => $$('.paso', l)
  function mostrar(i, nPasos = 0) {
    i = Math.max(0, Math.min(lams.length - 1, i))
    const ant = lams[idx]
    if (ant && ant !== lams[i]) { ant.classList.remove('activa'); G[ant.id]?.salir?.(ant); $$('video', ant).forEach(v => v.pause()) }
    idx = i; paso = 0
    const l = lams[idx]
    pasos(l).forEach(p => {
      p.classList.remove('ver')
      // Deshacer lo que agregó cada paso, para que retroceder deje la lámina en su estado correcto
      if (p.dataset.clase) { const [sel, cl] = p.dataset.clase.split('|'); $$(sel, l).forEach(e => e.classList.remove(cl)) }
    })
    void l.offsetWidth
    l.classList.add('activa')
    $$('.a [data-cuenta], .a[data-cuenta]', l).forEach(contar)
    G[l.id]?.entrar?.(l)
    // Videos que arrancan solos al llegar a la lámina
    $$('video[data-auto]', l).forEach(v => { v.currentTime = 0; v.playbackRate = +v.dataset.rate || 1; v.play().catch(() => {}) })
    for (let k = 0; k < nPasos; k++) avanzarPaso(true)
    actualizar()
  }
  function avanzarPaso(silencioso) {
    const l = lams[idx], ps = pasos(l)
    if (paso >= ps.length) return false
    const p = ps[paso]; paso++
    p.classList.add('ver')
    $$('[data-cuenta]', p).forEach(contar); if (p.dataset.cuenta) contar(p)
    if (p.dataset.clase) { const [sel, cl] = p.dataset.clase.split('|'); $$(sel, l).forEach(e => e.classList.add(cl)) }
    if (p.dataset.atenuar) $$(p.dataset.atenuar, l).forEach(e => e.classList.add('fuera'))
    if (p.dataset.play) { const v = $(p.dataset.play, l); v && (v.currentTime = 0, v.playbackRate = +v.dataset.rate || 1, v.play()) }
    G[l.id]?.paso?.(paso, l, silencioso)
    if (!silencioso) actualizar()
    return true
  }
  // Si el video de la lámina quedó detenido (Chrome bloquea el audio hasta el primer gesto), el primer clic o tecla lo reproduce.
  const videoDetenido = () => { const v = $('video[data-auto]', lams[idx]); return v && v.paused && !v.ended && v.currentTime < 0.5 ? v : null }
  const siguiente = () => { const v = videoDetenido(); if (v) { v.play().catch(() => {}); return } if (!avanzarPaso()) mostrar(idx + 1) }
  const anterior = () => { if (paso > 0) mostrar(idx, paso - 1); else mostrar(idx - 1, pasos(lams[idx - 1] || lams[0]).length) }

  function actualizar() {
    history.replaceState(null, '', '#' + (idx + 1))
    $('#prog').style.width = ((idx + 1) / lams.length * 100) + '%'
    const l = lams[idx], prox = lams[idx + 1]
    canal.postMessage({
      n: idx + 1, total: lams.length, paso, pasos: pasos(l).length,
      titulo: l.dataset.titulo || l.id, notas: l.dataset.notas || '',
      prox: prox ? (prox.dataset.titulo || prox.id) : '— fin —',
    })
  }

  addEventListener('keydown', e => {
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); siguiente() }
    else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); anterior() }
    else if (e.key === 'Home') mostrar(0)
    else if (e.key === 'End') mostrar(lams.length - 1)
    else if (e.key.toLowerCase() === 'f') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()
    // Video de la lámina actual: K pausa/sigue, J retrocede 10 s, L adelanta 10 s (como YouTube)
    else if (['k', 'j', 'l'].includes(e.key.toLowerCase())) { const v = $('video', lams[idx]); if (v) { const k = e.key.toLowerCase()
      if (k === 'k') v.paused ? v.play().catch(() => {}) : v.pause()
      else v.currentTime = Math.max(0, Math.min(v.duration - 0.1, v.currentTime + (k === 'l' ? 10 : -10))) } }
  })
  stage.addEventListener('click', e => { const cv = e.target.closest('video'); if (cv) { if (cv.controls) return; const v = videoDetenido(); v && v.play().catch(() => {}); return } if (!e.target.closest('a, button')) siguiente() })
  canal.onmessage = e => { if (e.data === 'sig') siguiente(); else if (e.data === 'ant') anterior(); else if (e.data === 'hola') actualizar() }

  // Velocidad propia del video (p. ej. la demo a 1,5×), también si se reproduce con los controles
  $$('video[data-rate]').forEach(v => v.addEventListener('play', () => { v.playbackRate = +v.dataset.rate }))
  // Al terminar un video automático, pasar a la lámina siguiente
  $$('video[data-auto]').forEach(v => v.addEventListener('ended', () => { if (lams[idx].contains(v) && !v.hasAttribute('data-hold')) mostrar(idx + 1) }))
  if (params.has('grabar')) document.body.classList.add('grabando')
  window.Deck = { mostrar, siguiente, anterior, get idx() { return idx }, get paso() { return paso }, lams }
  const desdeHash = parseInt(location.hash.slice(1)) || 1
  mostrar(desdeHash - 1, +params.get('paso') || 0)
})()
