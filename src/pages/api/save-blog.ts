import fs from 'fs';
import path from 'path';
import type { APIRoute } from 'astro';

interface BlogData {
  title: string;
  author: string;
  authorBio: string;
  publishedDate: string;
  readTime: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  featured?: boolean;
  likes?: number;
  comments?: number;
}

interface Blog extends BlogData {
  slug: string;
  authorImage: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const blogData: BlogData = await request.json();
    
    // Generate slug from title
    const slug = blogData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    // Read existing blogs
    const blogsPath = path.join(process.cwd(), 'data', 'blogs.json');
    let blogs: Blog[] = [];
    
    try {
      const blogsContent = fs.readFileSync(blogsPath, 'utf-8');
      blogs = JSON.parse(blogsContent);
    } catch (error) {
      console.log('No existing blogs file, creating new one');
    }
    
    // Check if slug already exists and make it unique
    let uniqueSlug = slug;
    let counter = 1;
    while (blogs.some((blog: Blog) => blog.slug === uniqueSlug)) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }
    
    // Create new blog object
    const newBlog: Blog = {
      slug: uniqueSlug,
      title: blogData.title,
      author: blogData.author,
      authorBio: blogData.authorBio,
      authorImage: "", // Could be added later
      publishedDate: blogData.publishedDate,
      readTime: blogData.readTime,
      excerpt: blogData.excerpt,
      content: blogData.content,
      category: blogData.category,
      tags: blogData.tags || [],
      featured: blogData.featured || false,
      likes: blogData.likes || 0,
      comments: blogData.comments || 0
    };
    
    // Add new blog to the beginning of the array (newest first)
    blogs.unshift(newBlog);
    
    // Write back to file
    fs.writeFileSync(blogsPath, JSON.stringify(blogs, null, 2));
    
    return new Response(JSON.stringify({ 
      success: true, 
      slug: uniqueSlug,
      message: 'Blog post saved successfully' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error saving blog:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to save blog post' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};