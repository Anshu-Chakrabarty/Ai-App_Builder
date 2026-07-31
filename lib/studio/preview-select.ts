// lib/studio/preview-select.ts — inject click-to-target helpers into preview HTML

/** Make preview elements clickable so Studio can target a section (default) or a field. */
export function injectPreviewSelectScript(html: string, selectedId?: string | null): string {
  const style = `
<style data-studio-select="1">
  [data-ai-id], section, header.hero, .media-hero, .hero, .split-media, .frame, .photo-grid, .page-banner, .feature-icons, .html-blocks-grid, img, h1, h2, h3 {
    cursor: pointer !important;
    transition: outline .15s ease, box-shadow .15s ease;
  }
  section:hover, .media-hero:hover, .hero:hover, .split-media-section:hover, .page-banner:hover, [data-ai-section]:hover {
    outline: 2px dashed #7c3aed66 !important;
    outline-offset: 4px;
  }
  .studio-picked {
    outline: 3px solid #7c3aed !important;
    outline-offset: 4px;
    box-shadow: 0 0 0 6px #7c3aed22 !important;
  }
  .studio-picked-inner {
    outline: 2px solid #a78bfa !important;
    outline-offset: 2px;
  }
</style>`;

  const selectedJson = JSON.stringify(selectedId || "");
  const script = `
<script data-studio-select="1">
(function(){
  var selected = ${selectedJson};
  function mark(el, precise){
    document.querySelectorAll('.studio-picked, .studio-picked-inner').forEach(function(n){
      n.classList.remove('studio-picked');
      n.classList.remove('studio-picked-inner');
    });
    if (!el) return;
    if (precise) el.classList.add('studio-picked-inner');
    else el.classList.add('studio-picked');
  }
  function sectionMeta(section){
    if (!section) return null;
    var cls = (section.className || '').toString();
    var aiSec = section.getAttribute('data-ai-section') || '';
    var aiId = section.getAttribute('data-ai-id') || '';
    var id = aiSec || section.id || '';
    var name = 'section';
    if (aiSec) name = aiSec;
    else if (section.id) name = section.id;
    else if (/media-hero|\\bhero\\b/i.test(cls) || section.tagName === 'HEADER') name = 'hero';
    else if (/split/i.test(cls)) name = 'split';
    else if (/feature-icons|feature/i.test(cls)) name = 'features';
    else if (/faq/i.test(cls)) name = 'faq';
    else if (/service/i.test(cls)) name = 'services';
    else if (/cta/i.test(cls)) name = 'cta';
    else if (/team/i.test(cls)) name = 'team';
    else if (/gallery|photo/i.test(cls)) name = 'gallery';
    else if (/banner/i.test(cls)) name = 'banner';
    else if (/html-blocks/i.test(cls)) name = 'blocks';
    else if (/site-form|\\bform\\b/i.test(cls)) name = 'form';
    var h = section.querySelector('h1,h2,h3');
    var label = (h && h.innerText) ? h.innerText.trim().slice(0, 48) : name;
    var canonical = aiId || name;
    if (!aiId) {
      if (name === 'hero') canonical = 'home.hero';
      else if (name === 'split') canonical = 'home.split';
      else if (name === 'gallery') canonical = 'home.gallery';
      else if (name === 'features') canonical = 'home.features';
      else if (name === 'banner') canonical = 'home.banner';
      else if (name === 'blocks') canonical = 'home.blocks';
      else if (name === 'cta') canonical = 'home.cta';
      else if (name === 'form') canonical = 'home.form';
      else if (id && id.indexOf('.') > 0) canonical = id;
      else if (name && name.indexOf('.') < 0) canonical = 'home.' + name;
    }
    return {
      id: canonical,
      kind: 'section',
      label: label,
      preview: (section.innerText || '').trim().slice(0, 100),
      sectionKey: name
    };
  }
  function resolveImageId(img){
    if (!img || !img.closest) return null;
    var withId = img.closest('[data-ai-id]');
    if (withId && withId.getAttribute('data-ai-id')) {
      return withId.getAttribute('data-ai-id');
    }
    if (img.closest('.media-hero, header.hero, .hero')) return 'media.hero';
    if (img.closest('.page-banner, [data-ai-section="banner"]')) return 'media.banner';
    if (img.closest('.split-media, .frame, .split-media-section, [data-ai-section="split"], #split')) return 'media.split';
    if (img.closest('.photo-grid, #gallery, [data-ai-section="gallery"]')) {
      var shots = img.closest('.photo-grid, #gallery');
      if (shots) {
        var imgs = shots.querySelectorAll('img');
        for (var i = 0; i < imgs.length; i++) {
          if (imgs[i] === img) return 'media.gallery.' + i;
        }
      }
      return 'media.gallery.0';
    }
    return null;
  }
  function resolvePrecise(el){
    var withId = el.closest('[data-ai-id]');
    if (withId) {
      return {
        id: withId.getAttribute('data-ai-id'),
        kind: withId.tagName === 'IMG' ? 'image' : 'field',
        label: withId.getAttribute('data-ai-id'),
        preview: (withId.innerText || withId.getAttribute('alt') || '').trim().slice(0, 80)
      };
    }
    var img = el.tagName === 'IMG' ? el : el.closest('img');
    if (img) {
      var imageId = resolveImageId(img);
      if (imageId) {
        return {
          id: imageId,
          kind: 'image',
          label: imageId,
          preview: (img.getAttribute('alt') || img.getAttribute('src') || '').slice(0, 80)
        };
      }
    }
    var heading = el.closest('h1,h2,h3');
    if (heading) {
      var inSplit = heading.closest('.split-media, .split-media-section, #split');
      var inGallery = heading.closest('#gallery, [data-ai-section="gallery"]');
      var inFeatures = heading.closest('.feature-icons, [data-ai-section="features"], #features');
      var id = 'hero.title';
      if (inSplit) id = 'visual.split.title';
      else if (inGallery) id = 'visual.gallery.title';
      else if (inFeatures) id = 'visual.features.title';
      return {
        id: id,
        kind: 'field',
        label: heading.innerText.trim().slice(0, 40) || id,
        preview: (heading.innerText || '').trim().slice(0, 80)
      };
    }
    return null;
  }
  function resolveTarget(el, precise){
    if (!el || !el.closest) return null;
    // Gallery card / shot → that specific image (Delivery, Menu, …)
    var shot = el.closest('.shot, [data-gallery-index]');
    if (shot) {
      var idx = shot.getAttribute('data-gallery-index');
      if (idx == null) {
        var sid = shot.getAttribute('data-ai-id') || '';
        var m = sid.match(/media\\.gallery\\.(\\d+)/);
        if (m) idx = m[1];
      }
      if (idx == null) {
        var img0 = shot.querySelector('img');
        var iid = img0 && img0.getAttribute('data-ai-id');
        var m2 = iid && iid.match(/media\\.gallery\\.(\\d+)/);
        if (m2) idx = m2[1];
      }
      if (idx != null) {
        var cap = shot.getAttribute('data-gallery-label') ||
          ((shot.querySelector('.cap') && shot.querySelector('.cap').innerText) || '').trim() ||
          ('Gallery card ' + (Number(idx) + 1));
        return {
          id: 'media.gallery.' + idx,
          kind: 'image',
          label: cap + ' image',
          preview: 'Gallery card · ' + cap
        };
      }
    }
    if (!precise) {
      var section = el.closest('section, header, .media-hero, .hero, .page-banner, .split-media-section, [data-ai-section], .html-blocks-grid');
      var meta = sectionMeta(section);
      if (meta) return meta;
    }
    var preciseHit = resolvePrecise(el);
    if (preciseHit) return preciseHit;
    var fallback = el.closest('section, header, .media-hero, .hero, .page-banner, .split-media-section, [data-ai-section]');
    return sectionMeta(fallback);
  }
  function onPick(e, precise){
    // Never hijack real form controls / nav CTAs unless Alt is held
    var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (!precise && (tag === 'a' || tag === 'button' || tag === 'input' || tag === 'textarea' || tag === 'select')) {
      return;
    }
    var t = resolveTarget(e.target, precise);
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    var markEl = precise
      ? (e.target.closest('[data-ai-id], img, h1, h2, h3') || e.target)
      : (e.target.closest('section, header, .media-hero, .hero, .page-banner, .split-media-section, [data-ai-section], .html-blocks-grid') || e.target);
    mark(markEl, precise);
    parent.postMessage({ type: 'studio-select', target: t }, '*');
  }
  // In-iframe nav → switch Studio page tab (full site browsing)
  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = (a.getAttribute('href') || '').trim();
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:')) return;
    if (!/\\.html?/i.test(href) && href.indexOf('.') !== -1) return;
    e.preventDefault();
    e.stopPropagation();
    var slug = href.split('/').pop() || href;
    parent.postMessage({ type: 'studio-navigate', slug: slug }, '*');
  }, true);
  document.addEventListener('click', function(e){
    var precise = !!(e.altKey || e.metaKey || e.ctrlKey);
    onPick(e, precise);
  }, true);
  document.addEventListener('dblclick', function(e){
    onPick(e, true);
  }, true);
  if (selected) {
    var hit = document.querySelector('[data-ai-id=\"' + selected.replace(/"/g, '') + '\"]')
      || document.querySelector('[data-ai-section=\"' + selected.replace(/^home\\./, '').replace(/"/g, '') + '\"]')
      || document.getElementById(selected.replace(/^home\\./, '').replace(/"/g, ''));
    if (hit) mark(hit, /media\\.|visual\\./.test(selected));
  }
})();
</script>`;

  let out = html;
  // Always refresh inject so updates aren't stuck with stale script
  out = out.replace(/<style data-studio-select="1">[\s\S]*?<\/style>/gi, "");
  out = out.replace(/<script data-studio-select="1">[\s\S]*?<\/script>/gi, "");
  if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, style + "</head>");
  else out = style + out;
  if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, script + "</body>");
  else out = out + script;
  return out;
}
