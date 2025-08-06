import {notFound} from 'next/navigation';
import {getRequestConfig} from 'next-intl/server';
 
// Can be imported from a shared config
const locales = ['en', 'es', 'pt'];
 
export default getRequestConfig(async ({requestLocale}) => {
  // This corresponds to the `[locale]` segment
  const locale = (await requestLocale) || 'en';
  
  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale)) notFound();
 
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
}); 