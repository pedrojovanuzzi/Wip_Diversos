import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels'; // Plugin para exibir rótulos nas barras
import { Bar } from 'react-chartjs-2';
import { NavBar } from '../../components/navbar/NavBar';
import { RootState, AppDispatch } from '../../types';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { chamadosMonthThunk, chamadosYearThunk, chamadosAllThunk, chamadosReturnMonthThunk, chamadosReturnYearThunk } from '../../slices/chamadosSlice';
import Message from '../../components/Message';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels); // Registrando o plugin





// Define uma paleta de cores para até 20 resultados
const colors = [
  '#00FFFF', '#FF0000', '#A0C538', '#FFC0CB', '#800080', '#FFD700', '#FF6347', '#4682B4', '#32CD32', '#FFA500',
  '#8A2BE2', '#DC143C', '#20B2AA', '#FF1493', '#00CED1', '#FF4500', '#7FFF00', '#8B4513', '#2E8B57', '#00008B'
];

export const ChamadosPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
  
  // Acessar dados e estados do Redux
  let { data: chamadosData = [], dataReturn: chamadosDataReturn, loading, error, loadingReturn, errorReturn } = useTypedSelector((state) => state.chamados);
  const { user } = useTypedSelector((state) => state.auth);

  // Estado para controlar o tipo de gráfico (mensal, anual, total)
  const [chartType, setChartType] = useState<'month' | 'year' | 'all'>('month');

  const [chartTypeReturn, setChartTypeReturn] = useState<'returnMonth' | 'returnYear'>('returnMonth');
  
  // Estado para detectar se é uma tela de celular
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);

  // Detectar mudança de tamanho da janela para ajustar a exibição
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (user?.token) {
      if (chartType === 'month') {
        dispatch(chamadosMonthThunk(user.token));
      } else if (chartType === 'year') {
        dispatch(chamadosYearThunk(user.token));
      } else if (chartType === 'all') {
        dispatch(chamadosAllThunk(user.token));
      }
    }
  }, [dispatch, user?.token, chartType]);

  useEffect(() => {
    if (user?.token) {
      if (chartTypeReturn === 'returnMonth') {
        dispatch(chamadosReturnMonthThunk(user.token));
      } else if (chartTypeReturn === 'returnYear') {
        dispatch(chamadosReturnYearThunk(user.token));
      }
    }
  }, [dispatch, user?.token, chartTypeReturn]);
  

  // Limitar o número de barras no gráfico se for mobile
  const limitedChamadosData = isMobile
    ? chamadosData.slice(0, 5) // Se for mobile, limita a 5 barras
    : chamadosData;



  // Limitar o número de barras no gráfico se for mobile
  const limitedChamadosReturnData = isMobile
  ? chamadosDataReturn.slice(0, 5) // Se for mobile, limita a 5 barras
  : chamadosDataReturn;

  // Define cores para até 20 barras
  const backgroundColors = limitedChamadosData.map((_: any, index: number) => colors[index % 20]);
  const borderColors = backgroundColors;

  // Dados para o gráfico
  const data = {
    labels: Array.isArray(limitedChamadosData) ? limitedChamadosData.map((item: any) => item.chamado_login) : [],
    datasets: [
      {
        label: 'Total Chamados',
        data: Array.isArray(limitedChamadosData) ? limitedChamadosData.map((item: any) => Number(item.totalChamados)) : [],
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1,
        barThickness: isMobile ? 20 : 40,
      },
    ],
  };


  const dataReturn = {
    labels: Array.isArray(limitedChamadosReturnData) ? limitedChamadosReturnData.map((item: any) => item.tecnicoNome) : [],
    datasets: [
      {
        label: 'Total Chamados Feitos',
        data: Array.isArray(limitedChamadosReturnData) ? limitedChamadosReturnData.map((item: any) => Number(item.totalChamados)) : [],
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1,
        barThickness: isMobile ? 20 : 40,
      },
    ],
  };

  let maxChamadosValue = Math.round(Math.max(...chamadosData.map((item: any) => Math.floor(Number(item.totalChamados)))) * 1.5);
  let maxChamadosReturnValue = Math.round(Math.max(...chamadosDataReturn.map((item: any) => Math.floor(Number(item.totalChamados)))) * 1.5);
  
  

  const options = {
    responsive: true,
    scales: {
      y: {
        beginAtZero: true,
        max: isMobile ? maxChamadosValue *= 1 : maxChamadosValue, // Define o valor máximo calculado dinamicamente
        grid: {
          display: false,
        },
        ticks: {
          color: '#000',
          font: {
            size: isMobile? 10 : 14, // Tamanho fixo da fonte
          },
          padding: 10, // Espaçamento à esquerda do eixo Y
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#000',
          font: {
            size: 12, // Tamanho fixo da fonte
          },
          maxRotation: 45, // Rotação máxima dos rótulos no eixo X
          minRotation: 0,  // Rotação mínima
          callback: function (val: any) {
            const label: string = val as string;
            return label.length > 10 ? `${label.substring(0, 10)}...` : label; // Limita o comprimento dos rótulos
          }
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      datalabels: {
        anchor: 'end' as const,  // Ajusta a âncora dos rótulos
        align: 'end' as const,  // Alinha os rótulos no final
        color: '#000',
        font: {
          size: isMobile? 7 : 10, // Tamanho fixo da fonte dos rótulos
          weight: 'bold' as const, // Peso da fonte
        },
        rotation: 340, // Rotaciona os rótulos em 90 graus
        formatter: (value: any, context: any) => context.chart.data.labels[context.dataIndex],
      },
    },
    layout: {
      padding: {
        left: 0, // Remove o espaçamento à esquerda do gráfico
        top: 20, // Padding superior fixo
      },
    },
    animation: {
      duration: 1000, // Duração da animação
    },
    elements: {
      bar: {
        borderRadius: isMobile? 5 : 10, // Cantos arredondados
        borderWidth: 0, // Remover bordas
      },
    },
  };

  const optionsReturn = {
    responsive: true,
    scales: {
      y: {
        beginAtZero: true,
        max: isMobile? maxChamadosReturnValue *= 1: maxChamadosReturnValue, // Define o valor máximo calculado dinamicamente
        grid: {
          display: false,
        },
        ticks: {
          color: '#000',
          font: {
            size: isMobile? 10 : 14, // Tamanho fixo da fonte
          },
          padding: 10, // Espaçamento à esquerda do eixo Y
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#000',
          font: {
            size: 12, // Tamanho fixo da fonte
          },
          maxRotation: 45, // Rotação máxima dos rótulos no eixo X
          minRotation: 0,  // Rotação mínima
          callback: function (val: any) {
            const label: string = val as string;
            return label.length > 10 ? `${label.substring(0, 10)}...` : label; // Limita o comprimento dos rótulos
          }
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      datalabels: {
        anchor: 'end' as const,  // Ajusta a âncora dos rótulos
        align: 'end' as const,  // Alinha os rótulos no final
        color: '#000',
        font: {
          size: isMobile? 7 : 10,
          weight: 'bold' as const, // Peso da fonte
        },
        rotation: 340, // Rotaciona os rótulos em 90 graus
        formatter: (value: any, context: any) => context.chart.data.labels[context.dataIndex],
      },
    },
    layout: {
      padding: {
        left: 0, // Remove o espaçamento à esquerda do gráfico
        top: 20, // Padding superior fixo
      },
    },
    animation: {
      duration: 1000, // Duração da animação
    },
    elements: {
      bar: {
        borderRadius: isMobile? 5 : 10, // Cantos arredondados
        borderWidth: 0, // Remover bordas
      },
    },
  };
  
  useEffect(() => {
    document.title = 'Chamados';
  }, []);

  return (
    <div>
      <NavBar />
      <div className='grid grid-cols-1 grid-rows-[100px] sm:grid-rows-[100px] justify-items-center items-center h-screen'>
        <h1 className='col-span-1 font-semibold sm:place-self-start sm:ml-40 sm:mt-10 text-2xl'>Chamados</h1>
        <h1 className='m-10 font-semibold'>Clientes com Mais Chamados</h1>
        
        <div className="flex gap-4 mb-4">
          <button 
            onClick={() => setChartType('month')} 
            className={`px-4 py-2 rounded ${chartType === 'month' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black'}`}>
            Mensal
          </button>
          <button 
            onClick={() => setChartType('year')} 
            className={`px-4 py-2 rounded ${chartType === 'year' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black'}`}>
            Anual
          </button>
          <button 
            onClick={() => setChartType('all')} 
            className={`px-4 py-2 rounded ${chartType === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black'}`}>
            Total
          </button>
        </div>
        {loading && <p className='text-black font-semibold gap-4 flex justify-center items-center h-5 m-20'><AiOutlineLoading3Quarters className='animate-spin text-black' />Carregando Página....</p>}
        {error && <Message msg={error === true ? String(error) : "Erro desconhecido"} type='error' />}
        <div className="w-screen  sm:h-screen sm:w-2/3 place-self-center">
          <Bar data={data} options={options} />
        </div>
        <h1 className='m-10 font-semibold'>Chamados Finalizados por Técnico</h1>
        <div className="flex gap-4 mb-4">
          <button 
            onClick={() => setChartTypeReturn('returnMonth')} 
            className={`px-4 py-2 rounded ${chartTypeReturn === 'returnMonth' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black'}`}>
            Mensal
          </button>
          <button 
            onClick={() => setChartTypeReturn('returnYear')} 
            className={`px-4 py-2 rounded ${chartTypeReturn === 'returnYear' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black'}`}>
            Anual
          </button>
        </div>
        {loadingReturn && <p className='text-black font-semibold gap-4 flex justify-center items-center h-5 m-20'><AiOutlineLoading3Quarters className='animate-spin text-black' />Carregando Página....</p>}
        {errorReturn && <Message msg={error === true ? String(error) : "Erro desconhecido"} type='error' />}
        <div className="w-screen  sm:h-screen sm:w-2/3 place-self-center">
          <Bar data={dataReturn} options={optionsReturn} />
        
        </div>
      </div>
    </div>
  );
};
