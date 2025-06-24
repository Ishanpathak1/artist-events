import fetch from 'node-fetch';

async function testTicketmasterAPI() {
  const keys = [
    'Z8APwACvztmTKFtOWZG3zKomqGVHbwiE', // New Consumer Key from screenshot
    'hgdeFRZFUqTOZdBj' // New Consumer Secret from screenshot
  ];
  
  for (const apiKey of keys) {
    console.log(`\n🔑 Testing key: ${apiKey.substring(0, 8)}...`);
    
    try {
      // Test with music-specific parameters
      const response = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?apikey=${apiKey}&size=5&segmentName=Music&dmaId=345&sort=date,asc`);
      
      console.log(`Status: ${response.status}`);
      
      if (response.ok) {
        console.log('✅ API Key works!');
        const data = await response.json();
        console.log(`Found ${data._embedded?.events?.length || 0} events`);
        
        if (data._embedded?.events?.length > 0) {
          console.log(`Sample event: ${data._embedded.events[0].name}`);
          console.log(`Venue: ${data._embedded.events[0]._embedded?.venues?.[0]?.name || 'N/A'}`);
          console.log(`Date: ${data._embedded.events[0].dates?.start?.localDate || 'N/A'}`);
        }
        
        console.log(`\n🎉 Working API Key: ${apiKey}`);
        return apiKey;
      } else {
        const errorText = await response.text();
        console.log(`❌ Error: ${errorText.substring(0, 200)}...`);
      }
    } catch (error) {
      console.log(`❌ Network error: ${error.message}`);
    }
  }
  
  console.log('\n⚠️  None of the API keys worked. Please check:');
  console.log('1. App status is "Approved" in Ticketmaster Developer Portal');
  console.log('2. API key is activated (sometimes takes a few minutes)');
  console.log('3. Try refreshing the page and copying the key again');
}

testTicketmasterAPI(); 