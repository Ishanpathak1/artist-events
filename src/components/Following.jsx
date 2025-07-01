import { useState, useEffect } from 'react';

const Following = () => {
  const [user, setUser] = useState(null);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadFollowingData();
  }, []);

  const loadFollowingData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check authentication
      const authResponse = await fetch('/api/auth/validate');
      if (!authResponse.ok) {
        window.location.href = '/auth/login?redirect=/following';
        return;
      }

      const authData = await authResponse.json();
      setUser(authData.user);

      // Load following data
      const statsResponse = await fetch('/api/dashboard/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setFollowing(statsData.allFollowing || []);
      }

    } catch (error) {
      console.error('Error loading following:', error);
      setError('Failed to load following data');
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async (artistId) => {
    try {
      const response = await fetch('/api/artist/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artist_id: artistId,
          action: 'unsubscribe'
        })
      });

      if (response.ok) {
        // Reload the data to reflect changes
        loadFollowingData();
      } else {
        console.error('Failed to unfollow artist');
      }
    } catch (error) {
      console.error('Error unfollowing artist:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        textAlign: 'center'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid #e2e8f0',
          borderTop: '4px solid #667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px'
        }}></div>
        <p>Loading artists you follow...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <h3>Oops! Something went wrong</h3>
        <p>{error}</p>
        <button 
          onClick={loadFollowingData}
          style={{
            background: '#667eea',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <section style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '2rem 0'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 20px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <a 
              href="/profile" 
              style={{
                color: 'white',
                textDecoration: 'none',
                fontSize: '1.5rem',
                transition: 'all 0.3s ease'
              }}
            >
              ← 
            </a>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: '700',
              margin: '0'
            }}>Artists You Follow</h1>
          </div>
          <p style={{
            opacity: '0.9',
            fontSize: '1.1rem'
          }}>
            You're following {following.length} {following.length === 1 ? 'artist' : 'artists'}
          </p>
        </div>
      </section>

      {/* Following List */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '3rem 20px'
      }}>
        {following.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem 0'
          }}>
            <div style={{
              fontSize: '4rem',
              marginBottom: '1rem'
            }}>🔔</div>
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#1e293b',
              marginBottom: '0.5rem'
            }}>No artists followed yet</h3>
            <p style={{
              color: '#64748b',
              marginBottom: '2rem'
            }}>
              Discover and follow your favorite artists to stay updated with their events.
            </p>
            <a 
              href="/artists" 
              style={{
                background: '#667eea',
                color: 'white',
                textDecoration: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontWeight: '600',
                transition: 'all 0.3s ease'
              }}
            >
              Discover Artists
            </a>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.5rem'
          }}>
            {following.map((artist, index) => (
              <div key={index} style={{
                background: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                border: '1px solid rgba(226, 232, 240, 0.8)',
                transition: 'all 0.3s ease'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '1rem',
                    fontWeight: '600',
                    overflow: 'hidden'
                  }}>
                    {artist.avatar_url ? (
                      <img src={artist.avatar_url} alt={artist.name} style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }} />
                    ) : (
                      getInitials(artist.stage_name || artist.name)
                    )}
                  </div>
                  
                  <div style={{ flex: '1' }}>
                    <h3 style={{
                      fontSize: '1.1rem',
                      fontWeight: '700',
                      color: '#1e293b',
                      marginBottom: '0.25rem'
                    }}>
                      {artist.stage_name || artist.name}
                    </h3>
                    <p style={{
                      color: '#64748b',
                      fontSize: '0.9rem'
                    }}>
                      {artist.email}
                    </p>
                  </div>
                </div>

                {artist.bio && (
                  <p style={{
                    color: '#64748b',
                    fontSize: '0.9rem',
                    marginBottom: '1rem',
                    lineHeight: '1.4'
                  }}>
                    {artist.bio.length > 100 ? artist.bio.substring(0, 100) + '...' : artist.bio}
                  </p>
                )}

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '1rem',
                  borderTop: '1px solid #f1f5f9'
                }}>
                  <span style={{
                    color: '#64748b',
                    fontSize: '0.8rem'
                  }}>
                    Following since {formatDate(artist.followed_at)}
                  </span>
                  
                  <button
                    onClick={() => handleUnfollow(artist.id)}
                    style={{
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    Unfollow
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 20px 3rem'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <a 
            href="/profile" 
            style={{
              background: 'white',
              color: '#667eea',
              textDecoration: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontWeight: '600',
              border: '1px solid #e2e8f0',
              transition: 'all 0.3s ease'
            }}
          >
            ← Back to Profile
          </a>
          
          <a 
            href="/followers" 
            style={{
              background: '#667eea',
              color: 'white',
              textDecoration: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontWeight: '600',
              transition: 'all 0.3s ease'
            }}
          >
            View Followers
          </a>
          
          <a 
            href="/artists" 
            style={{
              background: '#10b981',
              color: 'white',
              textDecoration: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontWeight: '600',
              transition: 'all 0.3s ease'
            }}
          >
            Discover More Artists
          </a>
        </div>
      </section>
    </div>
  );
};

export default Following; 