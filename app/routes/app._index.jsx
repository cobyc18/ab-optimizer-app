import { json } from "@remix-run/node";
import { useLoaderData, useOutletContext } from "@remix-run/react";

export const loader = async ({ request }) => {
  return json({ message: "Hello from loader!" });
};

export default function Dashboard() {
  const { message } = useLoaderData();
  const { user } = useOutletContext();

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ color: 'red', fontSize: '24px' }}>React Test Page</h1>
      
      <div style={{ 
        backgroundColor: '#f0f0f0', 
        padding: '20px', 
        margin: '20px 0',
        borderRadius: '8px',
        border: '2px solid #333'
      }}>
        <h2>If you see this styled div, React is working!</h2>
        <p><strong>Message from loader:</strong> {message}</p>
        <p><strong>User:</strong> {user?.firstName || 'Unknown'}</p>
        <p><strong>Shop:</strong> {user?.shop || 'Unknown'}</p>
      </div>

      <div style={{ 
        backgroundColor: '#e3f2fd', 
        padding: '20px', 
        margin: '20px 0',
        borderRadius: '8px',
        border: '2px solid #2196f3'
      }}>
        <h3>Tailwind Test</h3>
        <p className="text-blue-600 font-bold">If this text is blue and bold, Tailwind is working!</p>
        <p className="bg-yellow-200 p-4 rounded-lg">If this has a yellow background, Tailwind is working!</p>
      </div>

      <div style={{ 
        backgroundColor: '#fff3e0', 
        padding: '20px', 
        margin: '20px 0',
        borderRadius: '8px',
        border: '2px solid #ff9800'
      }}>
        <h3>Component Test</h3>
        <p>Testing if basic React components work:</p>
        <ul>
          <li>✅ This list item</li>
          <li>✅ Another list item</li>
          <li>✅ One more list item</li>
        </ul>
      </div>

      <button 
        onClick={() => alert('React events are working!')}
        style={{
          backgroundColor: '#4caf50',
          color: 'white',
          padding: '10px 20px',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '16px'
        }}
      >
        Click me to test React events!
      </button>
    </div>
  );
} 