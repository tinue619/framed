import './style.css';
import { initRouter, updateNav } from './router';
import type { Route } from './router';
import { renderProductsScreen }  from './screens/products/index';
import { renderProductEditor }   from './screens/product-editor/index';
import { renderProfilesScreen }  from './screens/profiles/index';
import { renderProfileEditor }   from './screens/profile-editor/index';
import { renderSectionEditor }   from './screens/section-editor/index';

let _destroy: (() => void) | null = null;

function handleRoute(route: Route) {
  const main = document.getElementById('main-content')!;
  _destroy?.();
  _destroy = null;
  main.innerHTML = '';
  updateNav(route.screen);

  if (route.screen === 'products') {
    _destroy = renderProductsScreen(main);
  } else if (route.screen === 'product-editor') {
    _destroy = renderProductEditor(main, route.id);
  } else if (route.screen === 'profiles') {
    _destroy = renderProfilesScreen(main);
  } else if (route.screen === 'profile-editor') {
    _destroy = renderProfileEditor(main, route.id);
  } else if (route.screen === 'section-editor') {
    renderSectionEditor(main);
    _destroy = () => { main.innerHTML = ''; };
  }
}

initRouter(handleRoute);
