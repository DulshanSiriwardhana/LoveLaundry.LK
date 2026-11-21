# Site Data Configuration

This file explains how to use and modify the centralized data file (`siteData.ts`) for the Love Laundry website.

## Overview

All website content, company information, and configuration data are centralized in `src/data/siteData.ts`. This makes it easy to update content without touching the component code.

## Company Information

```typescript
export const companyInfo = {
    name: "Love Laundry",
    tagline: "Fresh. Clean. Delivered with love.",
    description: "Professional Laundry Service",
    phone: "+94700000000",           // Update with actual phone
    whatsapp: "+94700000000",         // Update with actual WhatsApp
    email: "info@lovelaundry.lk",    // Update with actual email
    address: "Colombo, Sri Lanka",    // Update with actual address
    rating: "4.9",
    serviceCount: "10+",
    availability: "24/7",
    customerCount: "200+",
};
```

## How to Update Content

### 1. Hero Section
Edit `heroData` object to change:
- Badge text
- Main title and highlighted text
- Description
- Button labels
- Statistics (services count, rating, availability)

### 2. Services Section
Edit `services` array to add/remove/modify services:
```typescript
{
    title: "Service Name",
    subtitle: "Tagline",
    description: "Service description",
    image: "./path/to/image.jpg"
}
```

Edit `servicesSection` to change section headers and CTA.

### 3. Commercial Services Section
Edit `commercialServices` array to add/remove/modify commercial offerings:
```typescript
{
    icon: RiIconName,  // Import from react-icons/ri
    title: "Service Name",
    subtitle: "Tagline",
    description: "Description",
    features: ["Feature 1", "Feature 2", "Feature 3", "Feature 4"]
}
```

Edit `commercialSection` to change section headers and CTA.

### 4. Process/How It Works
Edit `processSteps` array to change the workflow steps:
```typescript
{
    number: "01",
    title: "Step Title",
    text: "Step description",
    icon: RiIconName
}
```

### 5. Why Love Laundry Section
Edit `features` array for the feature cards and `benefits` array for the bullet list.

Edit `whyLoveLaundrySection` for section headers and card content.

### 6. Contact Section
Edit `contactSection` to change:
- Badge text
- Title and description
- Feature bullets
- Button labels (phone/WhatsApp hrefs are auto-generated from companyInfo)

### 7. Navigation
Edit `navigationItems` array to modify navigation menu:
```typescript
{ id: "section-id", label: "Display Name" }
```

## Quick Updates Checklist

To customize for your business, update these fields in `siteData.ts`:

- [ ] `companyInfo.name` - Your company name
- [ ] `companyInfo.phone` - Your phone number
- [ ] `companyInfo.whatsapp` - Your WhatsApp number
- [ ] `companyInfo.email` - Your email address
- [ ] `companyInfo.address` - Your address
- [ ] `companyInfo.rating` - Your rating
- [ ] `companyInfo.customerCount` - Your customer count
- [ ] `services` - Your service offerings
- [ ] `commercialServices` - Your commercial services
- [ ] `heroData.title` - Hero section title
- [ ] `heroData.description` - Hero section description
- [ ] All image paths in `services` array

## Adding New Sections

1. Create your data structure in `siteData.ts`
2. Export it
3. Import it in your component
4. Use the data in your JSX

Example:
```typescript
// In siteData.ts
export const testimonials = [
    { name: "Customer Name", review: "Review text", rating: 5 }
];

// In your component
import { testimonials } from "../../data/siteData";

{testimonials.map(testimonial => (
    <div key={testimonial.name}>
        <p>{testimonial.review}</p>
    </div>
))}
```

## Icons

Icons are imported from `react-icons/ri`. Browse available icons at:
https://react-icons.github.io/react-icons/icons/ri/

To use a new icon:
1. Import it at the top of `siteData.ts`
2. Use it in your data structure:
```typescript
icon: RiNewIconName
```

## Benefits of Centralized Data

✅ Update all content from one file  
✅ No need to edit component code  
✅ Easy to maintain and translate  
✅ Type-safe with TypeScript  
✅ Reduced code duplication  
