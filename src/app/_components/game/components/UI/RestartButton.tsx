interface RestartButtonProps {
  onRestart: () => void;
}

export function RestartButton({ onRestart }: RestartButtonProps) {
  return (
    <button
      onClick={onRestart}
      className="absolute top-4 left-4 z-10 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
      title="Restart Game"
    >
      🔄 Restart
    </button>
  );
}
