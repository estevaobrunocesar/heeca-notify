/** Sem interface: o Notify é um serviço interno. A operação é pelo portal (admin) e pelo monitor. */
export default function Home() {
  return (
    <main>
      <h1 style={{ fontWeight: 500 }}>Heeca Notify</h1>
      <p>Serviço interno de notificações da plataforma Heeca. Veja <code>/api/health</code>.</p>
    </main>
  );
}
