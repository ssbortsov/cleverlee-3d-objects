# Cleverlee — 3D objects

3D-модели в пиксельном эффекте на спрайте 55×2: свет модели переводится в плитки
из пяти цветов (F5E900, F4387A, 8C03E8, 1D1D1B, FFFFFF).
Замена видеороликам: модуль ~150 КБ + модель 30–100 КБ в gzip.

**Галерея:** https://ssbortsov.github.io/cleverlee-3d-objects/

## Структура

| Путь | Что это |
|---|---|
| `index.html` | галерея: переключение моделей, настройки эффекта, просмотр своего .glb |
| `models.json` | список моделей и их ракурсы |
| `models/*.glb` | оптимизированные модели |
| `lib/dither-3d.min.js` | модуль (Three.js внутри), его и подключать на сайт |
| `lib/dither-3d.src.js` | исходник модуля; пересборка: `npm i && npm run build` |
| `tools/optimize.sh` | подготовка новой модели |

## Добавить модель

1. `npm i` (один раз).
2. `tools/optimize.sh путь/к/model.glb models/name.glb` — для гранёных моделей добавить `--flat`.
3. Открыть галерею, перетащить исходник, подобрать поворот кнопками X/Y/Z,
   нажать «копировать для models.json» и вставить запись в `models.json`
   (поправить `file`, `name`, `credit`).
4. Закоммитить и запушить — Pages обновится через минуту.

## Встраивание на сайт

Проще всего — кнопка «скачать для сайта» в галерее: она собирает архив с модулем, текущей моделью
(в том числе своей, перетащенной в галерею), готовой страницей `index.html` и фрагментом `embed.html`
с выставленными настройками (пиксель, сдвиг, диапазон, плитка, вращение, ракурс). Файлы кладутся на свой
сервер, фрагмент вставляется в страницу.

Или вручную:

```html
<div id="obj" style="width:100%; height:600px"></div>
<script type="module">
  import { mount } from 'https://ssbortsov.github.io/cleverlee-3d-objects/lib/dither-3d.min.js';
  mount(document.getElementById('obj'), {
    model: 'https://ssbortsov.github.io/cleverlee-3d-objects/models/sphere.glb',
    modelRotation: [0, 0, 0], tilt: [0.3, 0, 0], fit: 1.55, pixel: 4, offset: 0.18, range: 0.87
  });
</script>
```

Для продакшена лучше скопировать `lib/dither-3d.min.js` и нужные `.glb` на свой сервер.

### Параметры `mount(container, options)`

| Параметр | По умолчанию | Что делает |
|---|---|---|
| model / modelData | 'hands.glb' / null | путь к .glb или ArrayBuffer с его байтами |
| modelRotation | [0, 0, π/2] | поворот самой модели, радианы |
| tilt | [0.15, 0, -0.18] | стартовый ракурс |
| fit | 2.6 | размер в кадре |
| flat | false | освещение по граням (включается само, если нет нормалей) |
| pixel | 8 | размер «пикселя», CSS px (в галерее 4) |
| offset | 0 | начало шкалы спрайта, 0–1 (в галерее 0.18) |
| range | 0.75 | доля шкалы на объект, 0–1 (в галерее 0.87) |
| tile | true | плитки 2×2 |
| autoSpin, spinSpeed | true, 0.45 | автовращение вокруг вертикали |
| zoom, zoomMin, zoomMax | 4, 1.8, 9 | зум |
| interactive, wheelZoom | true, true | трекбол, зум колесом/щипком, двойной клик — сброс |
| palette, sprite | см. исходник | цвета и узор спрайта |

Возвращает `{ ready, set(opts), reset(), destroy() }`.
Рендер на паузе вне экрана; при `prefers-reduced-motion` автовращение выключено.

## Лицензии моделей

- Сфера — «Beautiful sphere» by 3DMish, CC BY 4.0, нужна подпись автора на сайте:
  https://sketchfab.com/3d-models/beautiful-sphere-f7340c6b9dad4b88b84e097bcd53bcd8
- Руки — Sketchfab, лицензию уточнить.
