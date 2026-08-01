const gallery = document.getElementById('gallery');
const status = document.getElementById('status');
const lightbox = document.getElementById('lightbox');
const lightboxImage = lightbox.querySelector('img');

function openImage(item) {
  lightboxImage.src = item.src;
  lightboxImage.alt = item.name || '';
  if (typeof lightbox.showModal === 'function') lightbox.showModal();
  else lightbox.setAttribute('open', '');
}

async function loadGallery() {
  try {
    const response = await fetch('/gallery.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    status.textContent = `${data.count || 0} 件作品`;
    if (!data.items?.length) {
      gallery.append(document.getElementById('empty').content.cloneNode(true));
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const item of data.items) {
      const figure = document.createElement('figure');
      figure.className = 'work';
      const image = document.createElement('img');
      image.className = 'loading';
      image.alt = item.name || '';
      image.loading = fragment.childElementCount < 3 ? 'eager' : 'lazy';
      image.decoding = 'async';
      image.draggable = false;
      image.addEventListener('load', () => image.classList.remove('loading'), { once: true });
      image.addEventListener('error', () => {
        image.classList.remove('loading');
        figure.classList.add('failed');
      }, { once: true });
      figure.addEventListener('click', () => openImage(item));
      figure.append(image);
      fragment.append(figure);
      image.sizes = '(max-width: 700px) 50vw, 33vw';
      image.srcset = item.srcset || '';
      image.src = item.src;
      if (image.complete) image.classList.remove('loading');
    }
    gallery.append(fragment);
  } catch (error) {
    status.textContent = '读取失败';
    gallery.innerHTML = `<section class="empty"><h1>暂时无法读取</h1><p>${error.message}</p></section>`;
  }
}

document.getElementById('close').addEventListener('click', () => {
  if (typeof lightbox.close === 'function') lightbox.close();
  else lightbox.removeAttribute('open');
});
lightbox.addEventListener('click', (event) => {
  if (event.target === lightbox) {
    if (typeof lightbox.close === 'function') lightbox.close();
    else lightbox.removeAttribute('open');
  }
});
document.addEventListener('contextmenu', (event) => event.preventDefault());
document.addEventListener('dragstart', (event) => event.preventDefault());
loadGallery();
