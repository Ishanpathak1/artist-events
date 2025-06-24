import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';

export const POST: APIRoute = async ({ request, redirect }) => {
  try {
    const formData = await request.formData();
    
    // Extract form data
    const title = formData.get('title') as string;
    const artist = formData.get('artist') as string;
    const date = formData.get('date') as string;
    const location = formData.get('location') as string;
    const description = formData.get('description') as string;
    const genre = formData.get('genre') as string;
    const ticketPrice = formData.get('ticketPrice') as string;
    const rsvp = formData.get('rsvp') as string;
    const blog = formData.get('blog') as string;
    const instagram = formData.get('instagram') as string;
    const x = formData.get('x') as string;
    const linkedin = formData.get('linkedin') as string;
    const tagsString = formData.get('tags') as string;

    // Validate required fields
    if (!title || !artist || !date || !location || !description || !genre) {
      return new Response('Missing required fields', { status: 400 });
    }

    // Parse tags from JSON string
    let tags: string[] = [];
    if (tagsString) {
      try {
        tags = JSON.parse(tagsString);
      } catch (e) {
        // If JSON parsing fails, treat as empty array
        tags = [];
      }
    }

    // Read existing events first
    const eventsPath = path.join(process.cwd(), 'data', 'events.json');
    let events = [];
    
    try {
      const eventsData = fs.readFileSync(eventsPath, 'utf-8');
      events = JSON.parse(eventsData);
    } catch (error) {
      // If file doesn't exist, start with empty array
      events = [];
    }

    // Create slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') // Remove leading/trailing dashes
      .trim() || 'event'; // Fallback if slug is empty

    // Ensure slug is unique by adding number if needed
    let finalSlug = slug;
    let counter = 1;
    while (events.find((event: any) => event.slug === finalSlug)) {
      finalSlug = `${slug}-${counter}`;
      counter++;
    }

    // Create event object
    const newEvent = {
      slug: finalSlug,
      artist,
      title,
      date,
      location,
      description,
      genre,
      ...(ticketPrice && { ticketPrice }),
      ...(rsvp && { rsvp }),
      ...(blog && { blog }),
      ...(instagram && { instagram }),
      ...(x && { x }),
      ...(linkedin && { linkedin }),
      tags,
      featured: false // New events are not featured by default
    };

    // Check if event with same slug already exists
    const existingEvent = events.find((event: any) => event.slug === finalSlug);
    if (existingEvent) {
      return new Response('An event with this title already exists', { status: 400 });
    }

    // Add new event
    events.push(newEvent);

    // Save back to file
    fs.writeFileSync(eventsPath, JSON.stringify(events, null, 2));

    // Redirect to the new event page
    return redirect(`/events/${finalSlug}`, 302);
  } catch (error) {
    console.error('Error saving event:', error);
    return new Response('Internal server error', { status: 500 });
  }
}; 