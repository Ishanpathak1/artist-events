export async function GET({ request }) {
  try {
    const envInfo = {
      nodeEnv: process.env.NODE_ENV,
      hasNeonUrl: !!process.env.NEON_DATABASE_URL,
      hasDbUrl: !!process.env.DATABASE_URL,
      neonUrlPreview: process.env.NEON_DATABASE_URL ? process.env.NEON_DATABASE_URL.substring(0, 50) + '...' : null,
      dbUrlPreview: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 50) + '...' : null,
      hasResendKey: !!process.env.RESEND_API_KEY,
      hasJwtSecret: !!process.env.JWT_SECRET,
      allEnvKeys: Object.keys(process.env).filter(key => 
        key.includes('DATABASE') || 
        key.includes('NEON') || 
        key.includes('RESEND') || 
        key.includes('JWT') ||
        key.includes('NODE_ENV')
      ),
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(envInfo, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Failed to get environment info',
      message: error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
} 