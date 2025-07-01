import { useState, useEffect } from 'react';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    followersCount: 0,
    followingCount: 0,
    recentFollowers: [],
    recentFollowing: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check authentication
      const authResponse = await fetch('/api/auth/validate');
      if (!authResponse.ok) {
        window.location.href = '/auth/login?redirect=/profile';
        return;
      }

      const authData = await authResponse.json();
      const userData = authData.user;
      setUser(userData);

      // Load stats
      try {
        const statsResponse = await fetch('/api/dashboard/stats');
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData);
        }
      } catch (statsError) {
        console.log('Could not load stats:', statsError);
        // Continue without stats - they'll show as 0
      }

    } catch (error) {
      console.error('Error loading profile:', error);
      setError('Failed to load profile data');
      // Redirect to login on critical error
      setTimeout(() => {
        window.location.href = '/auth/login?redirect=/profile';
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
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
        <p>Loading your profile...</p>
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
          onClick={loadProfileData}
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

  if (!user) {
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
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h3>Authentication Required</h3>
        <p>Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Profile Header */}
      <section style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '3rem 0'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '2rem',
          flexWrap: 'wrap'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: '700',
              fontSize: '1.8rem',
              border: '3px solid rgba(255, 255, 255, 0.3)',
              overflow: 'hidden'
            }}>
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }} />
              ) : (
                <span>{getInitials(user.name)}</span>
              )}
            </div>
            
            <div>
              <h1 style={{
                fontSize: '2rem',
                fontWeight: '700',
                marginBottom: '0.25rem'
              }}>{user.name}</h1>
              <p style={{
                opacity: '0.9',
                marginBottom: '0.75rem'
              }}>{user.email}</p>
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                flexWrap: 'wrap'
              }}>
                <span style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: '500',
                  background: user.user_type === 'artist' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                  color: user.user_type === 'artist' ? '#8b5cf6' : '#22c55e',
                  border: user.user_type === 'artist' ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)'
                }}>
                  {user.user_type === 'artist' ? '🎨 Artist' : '👥 Audience'}
                </span>
                {user.verified && (
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}>✓ Verified</span>
                )}
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            <a href="/dashboard" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '12px 20px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              transition: 'all 0.3s ease',
              background: 'white',
              color: '#667eea',
              border: '1px solid transparent'
            }}>
              📊 Dashboard
            </a>
            <a href="/auth/profile" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '12px 20px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              transition: 'all 0.3s ease',
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}>
              ⚙️ Edit Profile
            </a>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '3rem 20px 2rem'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2rem'
        }}>
          {/* Followers Card */}
          <div 
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '2rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(226, 232, 240, 0.8)',
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onClick={() => window.location.href = '/followers'}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1rem'
            }}>
              <div style={{ fontSize: '2rem' }}>👥</div>
              <h3 style={{
                fontSize: '1.2rem',
                fontWeight: '700',
                color: '#1e293b'
              }}>Followers</h3>
            </div>
            <div style={{
              fontSize: '3rem',
              fontWeight: '800',
              color: '#667eea',
              lineHeight: '1',
              marginBottom: '0.5rem'
            }}>{stats.followersCount}</div>
            <p style={{
              color: '#64748b',
              marginBottom: '1.5rem'
            }}>People following you</p>
            
            {stats.recentFollowers && stats.recentFollowers.length > 0 && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                {stats.recentFollowers.slice(0, 3).map((follower, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.5rem',
                    background: '#f8fafc',
                    borderRadius: '8px'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '0.7rem',
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
                    <span style={{
                      fontSize: '0.9rem',
                      color: '#374151',
                      fontWeight: '500'
                    }}>{follower.name}</span>
                  </div>
                ))}
                {stats.followersCount > 3 && (
                  <div style={{
                    color: '#667eea',
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    textAlign: 'center',
                    padding: '0.5rem'
                  }}>+{stats.followersCount - 3} more</div>
                )}
              </div>
            )}
          </div>

          {/* Following Card */}
          <div 
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '2rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(226, 232, 240, 0.8)',
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onClick={() => window.location.href = '/following'}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1rem'
            }}>
              <div style={{ fontSize: '2rem' }}>🔔</div>
              <h3 style={{
                fontSize: '1.2rem',
                fontWeight: '700',
                color: '#1e293b'
              }}>Following</h3>
            </div>
            <div style={{
              fontSize: '3rem',
              fontWeight: '800',
              color: '#667eea',
              lineHeight: '1',
              marginBottom: '0.5rem'
            }}>{stats.followingCount}</div>
            <p style={{
              color: '#64748b',
              marginBottom: '1.5rem'
            }}>Artists you follow</p>
            
            {stats.recentFollowing && stats.recentFollowing.length > 0 && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                {stats.recentFollowing.slice(0, 3).map((artist, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.5rem',
                    background: '#f8fafc',
                    borderRadius: '8px'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '0.7rem',
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
                    <span style={{
                      fontSize: '0.9rem',
                      color: '#374151',
                      fontWeight: '500'
                    }}>{artist.stage_name || artist.name}</span>
                  </div>
                ))}
                {stats.followingCount > 3 && (
                  <div style={{
                    color: '#667eea',
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    textAlign: 'center',
                    padding: '0.5rem'
                  }}>+{stats.followingCount - 3} more</div>
                )}
              </div>
            )}
          </div>

          {/* Activity Card */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2rem',
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
              <div style={{ fontSize: '2rem' }}>📈</div>
              <h3 style={{
                fontSize: '1.2rem',
                fontWeight: '700',
                color: '#1e293b'
              }}>Activity</h3>
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{
                  color: '#64748b',
                  fontWeight: '500'
                }}>Joined</span>
                <span style={{
                  color: '#1e293b',
                  fontWeight: '600'
                }}>{formatDate(user.created_at)}</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{
                  color: '#64748b',
                  fontWeight: '500'
                }}>User Type</span>
                <span style={{
                  color: '#1e293b',
                  fontWeight: '600'
                }}>
                  {user.user_type === 'artist' ? 'Artist' : 'Audience'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem 20px 3rem'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: '1.5rem'
        }}>Quick Actions</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem'
        }}>
          <a href="/artists" style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            textDecoration: 'none',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            transition: 'all 0.3s ease'
          }}>
            <div style={{
              fontSize: '2rem',
              marginBottom: '1rem'
            }}>🔍</div>
            <h3 style={{
              fontSize: '1.1rem',
              fontWeight: '700',
              color: '#1e293b',
              marginBottom: '0.5rem'
            }}>Discover Artists</h3>
            <p style={{
              color: '#64748b',
              fontSize: '0.9rem'
            }}>Find new artists to follow</p>
          </a>

          <a href="/events" style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            textDecoration: 'none',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            transition: 'all 0.3s ease'
          }}>
            <div style={{
              fontSize: '2rem',
              marginBottom: '1rem'
            }}>🎤</div>
            <h3 style={{
              fontSize: '1.1rem',
              fontWeight: '700',
              color: '#1e293b',
              marginBottom: '0.5rem'
            }}>Browse Events</h3>
            <p style={{
              color: '#64748b',
              fontSize: '0.9rem'
            }}>See upcoming events</p>
          </a>

          {user.user_type === 'artist' && (
            <a href="/dashboard/email-campaigns" style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              textDecoration: 'none',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(226, 232, 240, 0.8)',
              transition: 'all 0.3s ease'
            }}>
              <div style={{
                fontSize: '2rem',
                marginBottom: '1rem'
              }}>📧</div>
              <h3 style={{
                fontSize: '1.1rem',
                fontWeight: '700',
                color: '#1e293b',
                marginBottom: '0.5rem'
              }}>Email Campaigns</h3>
              <p style={{
                color: '#64748b',
                fontSize: '0.9rem'
              }}>Manage your fan emails</p>
            </a>
          )}

          <a href="/submit" style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            textDecoration: 'none',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            transition: 'all 0.3s ease'
          }}>
            <div style={{
              fontSize: '2rem',
              marginBottom: '1rem'
            }}>➕</div>
            <h3 style={{
              fontSize: '1.1rem',
              fontWeight: '700',
              color: '#1e293b',
              marginBottom: '0.5rem'
            }}>Submit Event</h3>
            <p style={{
              color: '#64748b',
              fontSize: '0.9rem'
            }}>Add a new event</p>
          </a>
        </div>
      </section>
    </div>
  );
};

export default Profile; 