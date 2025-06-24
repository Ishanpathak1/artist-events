export async function GET() {
    return new Response(JSON.stringify({
        success: true,
        message: 'Test API endpoint working'
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

export async function POST({ request }) {
    try {
        const body = await request.json();
        return new Response(JSON.stringify({
            success: true,
            message: 'Test POST endpoint working',
            received: body
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
} 