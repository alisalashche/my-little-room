// left panel: catalog cards, basics and their colour swatches
const BASIC_THUMBS = {
  walls: 'url(textures/wallpaper-print.jpg) center / 140% auto',
  linoleum: '#813d2e',
  furniture: 'url(textures/oak.jpg) center / cover',
};

const makeCard = ({ id, label, thumb, max = 1, image = true }) => {
  const $item = document.createElement('li');
  $item.classList.add('cards__item');
  const $card = document.createElement('button');
  $card.type = 'button';
  $card.classList.add('card');
  $card.dataset.id = id;
  const $thumb = document.createElement(image ? 'img' : 'span');
  $thumb.classList.add('card__thumb');
  if (image) {
    $thumb.src = `thumbs/${thumb || id}.png`;
    $thumb.alt = '';
    $thumb.loading = 'lazy';
  } else {
    $thumb.style.background = thumb;
  }
  const $label = document.createElement('span');
  $label.classList.add('card__label');
  $label.textContent = label;
  $card.append($thumb, $label);
  if (max > 1) {
    const $badge = document.createElement('span');
    $badge.classList.add('card__badge');
    $badge.textContent = `x${max}`;
    $card.append($badge);
  }
  $item.append($card);
  return $item;
};

export const createPanel = ({ items, basics, onPick, onBasic, countOf, placingId }) => {
  const $basics = document.querySelector('.cards--basics');
  const $swatches = document.querySelector('.swatches');
  const $panel = document.querySelector('.panel');
  let openBasic = null;
  const chosen = {}; // basic id -> option index

  // catalog cards per group
  items.forEach((item) => {
    const $list = document.querySelector(`.cards[data-group="${item.group}"]`);
    $list.append(makeCard(item));
  });

  // basics cads
  basics.forEach((basic) => {
    chosen[basic.id] = 0;
    $basics.append(makeCard({ ...basic, thumb: BASIC_THUMBS[basic.id], image: false }));
  });

  const showSwatches = (basic) => {
    $swatches.innerHTML = '';
    $swatches.hidden = !basic;
    if (!basic) return;
    basic.options.forEach((option, index) => {
      const $item = document.createElement('li');
      const $swatch = document.createElement('button');
      $swatch.type = 'button';
      $swatch.classList.add('swatch');
      $swatch.classList.toggle('swatch--active', chosen[basic.id] === index);
      $swatch.style.backgroundColor = option.swatch || option.paint || option.color;
      if (option.texture) $swatch.style.backgroundImage = `url(${option.texture})`;
      $swatch.setAttribute('aria-label', option.label);
      $swatch.title = option.label;
      $swatch.addEventListener('click', () => {
        chosen[basic.id] = index;
        onBasic(basic, option);
        showSwatches(basic);
      });
      $item.append($swatch);
      $swatches.append($item);
    });
  };

  const refresh = () => {
    const placing = placingId();
    document.querySelectorAll('.card').forEach(($card) => {
      const { id } = $card.dataset;
      const item = items.find((entry) => entry.id === id);
      if (item) {
        const left = (item.max || 1) - countOf(id);
        $card.classList.toggle('card--used', left <= 0);
        $card.classList.toggle('card--active', placing === id);
        $card.disabled = left <= 0 && placing !== id;
      } else {
        $card.classList.toggle('card--active', openBasic === id);
      }
    });
  };

  // fade on the right edge of a row, gone when scrolled to the end
  const updateFade = ($row) => {
    const $cards = $row.querySelector('.cards');
    const end = $cards.scrollLeft + $cards.clientWidth >= $cards.scrollWidth - 4;
    $row.classList.toggle('row--end', end);
  };
  const $rows = document.querySelectorAll('.row');
  $rows.forEach(($row) => {
    $row.querySelector('.cards').addEventListener('scroll', () => updateFade($row), { passive: true });
  });
  const updateFades = () => $rows.forEach(updateFade);
  window.addEventListener('resize', updateFades);

  //show one tab at a time
  document.querySelectorAll('.tabs__tab').forEach(($tab) => {
    $tab.addEventListener('click', () => {
      $panel.dataset.tab = $tab.dataset.tab;
      updateFades();
    });
  });

  $panel.addEventListener('click', (event) => {
    const $card = event.target.closest('.card');
    if (!$card) return;
    const { id } = $card.dataset;
    const basic = basics.find((entry) => entry.id === id);
    if (basic) {
      openBasic = openBasic === id ? null : id;
      showSwatches(openBasic ? basic : null);
    } else {
      onPick(items.find((entry) => entry.id === id));
    }
    refresh();
  });

  refresh();
  updateFades();
  return { refresh };
};
