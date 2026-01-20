import { Metadata } from 'next';

interface StructuredDataProps {
  type?: 'LocalBusiness' | 'Organization' | 'WebSite';
  businessName?: string;
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  };
  contactPoint?: {
    telephone?: string;
    contactType?: string;
    email?: string;
  };
  openingHours?: string[];
  priceRange?: string;
  image?: string;
  url?: string;
  description?: string;
}

export function StructuredData({
  type = 'LocalBusiness',
  businessName = 'glammednailsbyjhen',
  address = {
    addressLocality: 'Manila',
    addressRegion: 'Metro Manila',
    addressCountry: 'PH',
  },
  contactPoint = {
    telephone: '+639451781774',
    contactType: 'Customer Service',
    email: 'glammednailsbyjhen@gmail.com',
  },
  openingHours = [],
  priceRange = '$$',
  image = '/logo.png',
  url,
  description = 'Premium Russian manicure, nail art, pedicure, and nail extension services in Manila, Philippines.',
}: StructuredDataProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://glammednailsbyjhen.vercel.app';
  const fullUrl = url || siteUrl;
  const imageUrl = image.startsWith('http') ? image : `${siteUrl}${image}`;

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: businessName,
    description,
    image: imageUrl,
    url: fullUrl,
    telephone: contactPoint.telephone,
    email: contactPoint.email,
    address: {
      '@type': 'PostalAddress',
      addressLocality: address.addressLocality,
      addressRegion: address.addressRegion,
      addressCountry: address.addressCountry,
      ...(address.streetAddress && { streetAddress: address.streetAddress }),
      ...(address.postalCode && { postalCode: address.postalCode }),
    },
    priceRange,
    ...(openingHours.length > 0 && { openingHoursSpecification: openingHours.map(hours => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: hours.split(' ')[0],
      opens: hours.split(' ')[1]?.split('-')[0],
      closes: hours.split(' ')[1]?.split('-')[1],
    })) }),
    sameAs: [
      'https://www.facebook.com/profile.php?id=61557672954391',
      'https://www.instagram.com/glammednailsbyjhen',
    ],
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: businessName,
    url: siteUrl,
    description,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/booking?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: businessName,
    url: fullUrl,
    logo: imageUrl,
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: contactPoint.telephone,
      contactType: contactPoint.contactType,
      email: contactPoint.email,
    },
    sameAs: [
      'https://www.facebook.com/profile.php?id=61557672954391',
      'https://www.instagram.com/glammednailsbyjhen',
    ],
  };

  let schema;
  switch (type) {
    case 'WebSite':
      schema = websiteSchema;
      break;
    case 'Organization':
      schema = organizationSchema;
      break;
    case 'LocalBusiness':
    default:
      schema = localBusinessSchema;
      break;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

