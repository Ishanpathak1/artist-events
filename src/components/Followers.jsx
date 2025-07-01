import { useState, useEffect } from 'react';

const Followers = () => {
  const [user, setUser] = useState(null);
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadFollowersData();
  }, []);

  const loadFollowersData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check authentication
      const authResponse = await fetch('/api/auth/validate');
      if (!authResponse.ok) {
        window.location.href = '/auth/login?redirect=/followers';
        return;
      }

      const authData = await authResponse.json();
      setUser(authData.user);

      // Load followers data
      const statsResponse = await fetch('/api/dashboard/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setFollowers(statsData.allFollowers || []);
      }

    } catch (error) {
      console.error('Error loading followers:', error);
      setError('Failed to load followers data');
    } finally {
      setLoading(false);
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
        <p>Loading your followers...</p>
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
          onClick={loadFollowersData}
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
            }}>Your Followers</h1>
          </div>
          <p style={{
            opacity: '0.9',
            fontSize: '1.1rem'
          }}>
            {followers.length} {followers.length === 1 ? 'person follows' : 'people follow'} you
          </p>
        </div>
      </section>

      {/* Followers List */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '3rem 20px'
      }}>
        {followers.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem 0'
          }}>
            <div style={{
              fontSize: '4rem',
              marginBottom: '1rem'
            }}>👥</div>
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#1e293b',
              marginBottom: '0.5rem'
            }}>No followers yet</h3>
            <p style={{
              color: '#64748b',
              marginBottom: '2rem'
            }}>
              When people start following you, they'll appear here.
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
            {followers.map((follower, index) => (
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
                    {follower.avatar_url ? (
                      <img src={follower.avatar_url} alt={follower.name} style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }} />
                    ) : (
                      getInitials(follower.name)
                    )}
                  </div>
                  
                  <div style={{ flex: '1' }}>
                    <h3 style={{
                      fontSize: '1.1rem',
                      fontWeight: '700',
                      color: '#1e293b',
                      marginBottom: '0.25rem'
                    }}>
                      {follower.name}
                    </h3>
                    <p style={{
                      color: '#64748b',
                      fontSize: '0.9rem'
                    }}>
                      {follower.email}
                    </p>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '1rem',
                  borderTop: '1px solid #f1f5f9'
                }}>
                  <div>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      background: follower.user_type === 'artist' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                      color: follower.user_type === 'artist' ? '#8b5cf6' : '#22c55e',
                      border: follower.user_type === 'artist' ? '1px solid rgba(139, 92, 246, 0.2)' : '1px solid rgba(34, 197, 94, 0.2)'
                    }}>
                      {follower.user_type === 'artist' ? '🎨 Artist' : '👥 Audience'}
                    </span>
                  </div>
                  
                  <span style={{
                    color: '#64748b',
                    fontSize: '0.8rem'
                  }}>
                    Followed {formatDate(follower.followed_at)}
                  </span>
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
            href="/following" 
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
            View Following
          </a>
        </div>
      </section>
    </div>
  );
};

export default Followers; 